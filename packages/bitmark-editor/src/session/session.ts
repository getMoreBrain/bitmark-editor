import type { EditChanges } from '../editor/textEditor.js';
import {
  BitmarkEngine,
  createBitmarkEngine,
  createLatestRunner,
  LoadBitmarkEngineOptions,
  loadBitmarkModule,
  parserCdnUrl,
  SUPERSEDED,
} from '../engine/index.js';
import { log } from '../log.js';
import {
  bindBitmarkJsonSchema,
  loadBitmarkJsonSchema,
  schemaUrlFor,
  schemaUrlForVersion,
} from '../monaco/jsonSchema.js';
import { debounce } from '../monaco/modelJob.js';
import { setupBitmarkMonaco } from '../monaco/setup.js';
import { jsonTextFor } from '../panes/jsonText.js';
import { createScrollSyncGroup } from '../scroll/scrollSyncGroup.js';
import { applyBitmarkTheme, BitmarkTheme, DEFAULT_THEME } from '../theme/applyTheme.js';
import { resolveMessages } from './messages.js';
import { createSessionDocument } from './sessionDocument.js';
import type {
  BitmarkPane,
  BitmarkSession,
  BitmarkSessionOptions,
  EditOrigin,
  EngineSource,
  LastEdit,
  PaneControl,
  SessionEvents,
  SessionInternals,
} from './types.js';

const isEngine = (s: EngineSource): s is BitmarkEngine =>
  typeof (s as BitmarkEngine).bitmarkToJsonText === 'function';
const isPromise = (s: EngineSource): s is Promise<BitmarkEngine> =>
  typeof (s as Promise<BitmarkEngine>).then === 'function';
const isRaw = (s: EngineSource): s is Extract<EngineSource, { module: unknown }> =>
  typeof (s as { module?: unknown }).module === 'object';

/** The engine for `source`, whether the session loads it, and the URL it came from. */
const resolveEngine = (
  source: EngineSource | undefined,
): {
  engine: Promise<BitmarkEngine>;
  loading: boolean;
  url?: string;
  /** The load path's stage 2: settles when the full variant lands, or fails. */
  stage2?: Promise<unknown>;
} => {
  if (source && isEngine(source)) return { engine: Promise.resolve(source), loading: false };
  if (source && isPromise(source)) return { engine: source, loading: false };
  if (source && isRaw(source)) {
    // Injected (D7): never initialised here; the host declares its variant.
    return {
      engine: Promise.resolve(createBitmarkEngine(source.module, { feature: source.feature })),
      loading: false,
    };
  }
  const options = (source ?? {}) as LoadBitmarkEngineOptions;
  const url = options.url ?? parserCdnUrl(options.version);
  // The load path (D2): two stages, the second followed here so that a
  // failure ends "loading" (the markup panes then say they need the full parser).
  const loaded = loadBitmarkModule(url, options);
  const engine = loaded.then(({ module, stage2 }) => {
    const e = createBitmarkEngine(module, { feature: 'bitmark-json' });
    stage2.then(
      (feature) => e.setFeature(feature),
      () => undefined,
    );
    return e;
  });
  const stage2 = loaded.then(({ stage2 }) => stage2);
  stage2.catch(() => undefined);
  return { engine, loading: true, url, stage2 };
};

/**
 * The changes of two edits, one after the other (PLAN-043 D1): `undefined`
 * unless both tell theirs and the second starts from the text the first made.
 */
const chained = (
  first: EditChanges | undefined,
  made: string,
  next: EditChanges | undefined,
): EditChanges | undefined =>
  first && next && next.base === made
    ? { base: first.base, changes: [...first.changes, ...next.changes] }
    : undefined;

/**
 * One bitmark document (PLAN-022 D9). The bitmark text is the source of
 * truth: an edit in any pane converts to bitmark, then every other pane
 * regenerates from it; the edited pane keeps the user's text. A failed
 * conversion keeps the last good document, marks the edited pane and shows
 * the others as stale (D15).
 */
export const createBitmarkSession = (options: BitmarkSessionOptions): BitmarkSession => {
  const { monaco } = options;
  setupBitmarkMonaco({ monaco });
  const messages = resolveMessages(options.messages);
  const scrollGroup = options.scrollGroup ?? createScrollSyncGroup();
  const controls: PaneControl[] = [];
  const listeners: { [K in keyof SessionEvents]: Set<(e: SessionEvents[K]) => void> } = {
    change: new Set(),
    error: new Set(),
    ready: new Set(),
  };
  const emit = <K extends keyof SessionEvents>(event: K, e: SessionEvents[K]) => {
    for (const l of listeners[event]) l(e);
  };

  let bitmark = options.value ?? '';
  let version = 0;
  let lastEdit: LastEdit | undefined;
  let editCount = 0;
  let engine: BitmarkEngine | undefined;
  let theme = options.theme;
  let syncLine = options.syncLine ?? true;
  let syncMatch = options.syncMatch ?? true;
  // The session's own copy: a host that changes its object changes nothing here.
  let bitmarkOptions = options.bitmarkOptions && Object.freeze({ ...options.bitmarkOptions });
  let disposed = false;
  let stage2Pending = false;
  /**
   * +1 per edit started and per commit: a conversion whose number is no
   * longer the latest is dropped, result and error alike, so a slow
   * conversion can never overwrite a newer edit (from any pane, or the API).
   */
  let editSeq = 0;
  let offFeature: (() => void) | undefined;
  let engineError: Error | undefined;

  const resolved = resolveEngine(options.engine);
  stage2Pending = resolved.loading;
  const ready = resolved.engine;

  // The session-wide theme: Monaco's is global, so it is set here once (D11).
  // Without a `theme`, the panes use the dark palette, so Monaco gets the
  // same default rather than keeping a light theme under dark tokens.
  let monacoTheme: ReturnType<typeof applyBitmarkTheme> | undefined;
  const applyMonacoTheme = (next: BitmarkTheme | undefined) => {
    if (!options.applyMonacoTheme) return;
    const effective = next ?? DEFAULT_THEME;
    if (monacoTheme) monacoTheme.setTheme(effective);
    else
      monacoTheme = applyBitmarkTheme(document.createElement('div'), effective, {
        monaco,
        applyMonacoTheme: true,
      });
  };
  applyMonacoTheme(theme);
  // No theme, and Monaco's theme left to the host: the dark token palette
  // meets whatever Monaco theme the host has, `vs` (light) unless it set one.
  if (theme === undefined && !options.applyMonacoTheme) {
    log.warnOnce(
      'theme-unset',
      `no \`theme\`: the bitmark token colours use the ${DEFAULT_THEME} palette, but your Monaco keeps its own theme ` +
        '(light `vs` unless you set one). Set `theme` to match your Monaco, or pass `applyMonacoTheme: true`.',
    );
  }

  // The text kept converted, for the output panes (PLAN-035 D6).
  const sessionDocument = createSessionDocument();

  /**
   * The last edit's text, where it is still to be read from its pane
   * (`commitEdit`): read once, at the latest before the pane's text is
   * replaced or the pane goes.
   */
  let unread: { c: PaneControl; read: () => string } | undefined;
  /** Something reads the edits' text (a mapping report): it is then taken with each edit. */
  let contentRead = false;
  const settleLastEdit = (c?: PaneControl) => {
    if (unread && (!c || unread.c === c)) unread.read();
  };

  const commit = (
    text: string,
    source: PaneControl | undefined,
    edit: Omit<EditOrigin, 'content'> | undefined,
    content: string | (() => string),
    changes?: EditChanges,
  ) => {
    editSeq++;
    const before = bitmark;
    bitmark = text;
    version++;
    // An edit's own changes, where they start from the text the session held
    // (PLAN-043 D4): free where the two are one string, as after each edit of
    // one pane. Otherwise the change is found by comparing.
    sessionDocument.commit(
      before,
      text,
      version,
      !source,
      changes && changes.base === before ? changes.changes : undefined,
    );
    if (edit) {
      const origin = { inputFormat: edit.inputFormat, label: edit.label, count: ++editCount };
      unread = undefined;
      if (typeof content === 'string' || !source) {
        lastEdit = { ...origin, content: typeof content === 'string' ? content : content() };
      } else {
        // A pane's large text is not copied for each keystroke: it is read when asked for.
        let value: string | undefined;
        let from: (() => string) | undefined = content;
        const read = () => {
          if (value === undefined) {
            if (unread?.read === read) unread = undefined;
            try {
              value = from!();
            } catch (e) {
              log.warn('the text of the last edit could not be read', e);
              value = '';
            }
            // The pane is not held on to through its text.
            from = undefined;
          }
          return value;
        };
        unread = { c: source, read };
        lastEdit = Object.defineProperty(origin as LastEdit, 'content', {
          enumerable: true,
          get: () => {
            contentRead = true;
            return read();
          },
        });
        if (contentRead) read();
      }
    } else {
      // Not an edit: the panes are replaced, the last edit's text with them.
      settleLastEdit();
    }
    source?.showSourceError(undefined);
    // An API change (no source pane) replaces the text even where the user
    // has focus: it is the new document, not an echo of their typing.
    for (const c of controls) if (c !== source) c.render({ force: !source });
    emit('change', { bitmark, source: source?.pane });
  };

  // One conversion schedule for the session: latest edit wins (D12, D14).
  const convert = createLatestRunner(async (c: PaneControl, text: string) => {
    const e = engine ?? (await ready);
    return c.toBitmark!(e, text, bitmarkOptions);
  });

  const runEdit = (c: PaneControl, text: string, changes?: EditChanges) => {
    if (!c.toBitmark) {
      commit(text, c, { inputFormat: c.inputFormat, label: c.label }, text, changes);
      return;
    }
    const seq = ++editSeq;
    convert(c, text).then(
      (out) => {
        if (disposed || out === SUPERSEDED || seq !== editSeq) return;
        commit(out.bitmark, c, { inputFormat: c.inputFormat, label: c.label }, text);
        c.pinInput(text, out.inputStarts);
      },
      (err: unknown) => {
        if (disposed || seq !== editSeq) return;
        const error = err instanceof Error ? err : new Error(String(err));
        c.showSourceError(error);
        for (const other of controls) if (other !== c) other.setStale(true);
        emit('error', { error, pane: c.pane, edit: true });
      },
    );
  };

  /** The latest edit, waiting out the debounce: a text to convert, or one converted already. */
  let pending:
    | { c: PaneControl; text: string; changes?: EditChanges }
    | { c: PaneControl; converted: string; content: () => string; changes?: EditChanges }
    | { c: PaneControl; error: Error }
    | undefined;
  const flush = debounce(() => {
    const p = pending;
    pending = undefined;
    if (!p || disposed) return;
    if ('error' in p) {
      p.c.showSourceError(p.error);
      for (const other of controls) if (other !== p.c) other.setStale(true);
      emit('error', { error: p.error, pane: p.c.pane, edit: true });
      return;
    }
    if ('text' in p) {
      runEdit(p.c, p.text, p.changes);
      return;
    }
    const { c, converted, content, changes } = p;
    commit(converted, c, { inputFormat: c.inputFormat, label: c.label }, content, changes);
  }, options.debounceMs ?? 0);

  const session: SessionInternals = {
    monaco,
    get engine() {
      return engine;
    },
    ready,
    messages,
    scrollGroup,
    get theme() {
      return theme;
    },
    get engineStage2Pending() {
      return stage2Pending;
    },
    get version() {
      return version;
    },
    get lastEdit() {
      return lastEdit;
    },
    getBitmark: () => bitmark,
    setBitmark: (text, origin) => {
      // The new document replaces an edit still waiting out the debounce,
      // as it replaces one in flight (commit's editSeq).
      flush.cancel();
      pending = undefined;
      const edit =
        origin === false ? undefined : (origin ?? { inputFormat: 'bitmark', label: 'API' });
      commit(text, undefined, edit, origin ? origin.content : text);
    },
    getJson: async (opts) => {
      const e = engine ?? (await ready);
      // Exactly the JSON pane's text (PLAN-029 R3).
      return (await jsonTextFor(e, bitmark, opts?.mode)).text;
    },
    panes: () => controls.map((c) => c.pane),
    setScrollSync: (panes: readonly BitmarkPane[]) => {
      for (const c of controls) c.pane.setScrollSync(panes.includes(c.pane));
    },
    get syncLine() {
      return syncLine;
    },
    setSyncLine: (on) => {
      if (on === syncLine) return;
      syncLine = on;
      for (const c of controls) c.syncViewChanged();
    },
    get syncMatch() {
      return syncMatch;
    },
    setSyncMatch: (on) => {
      if (on === syncMatch) return;
      syncMatch = on;
      for (const c of controls) c.syncViewChanged();
    },
    setTheme: (next) => {
      theme = next;
      applyMonacoTheme(next);
      for (const c of controls) c.applyTheme(next);
    },
    get bitmarkOptions() {
      return bitmarkOptions;
    },
    setBitmarkOptions: (next) => {
      const keys = new Set([...Object.keys(next ?? {}), ...Object.keys(bitmarkOptions ?? {})]);
      const read = (of: object | undefined, key: string) => (of as Record<string, unknown>)?.[key];
      if ([...keys].every((key) => read(next, key) === read(bitmarkOptions, key))) return;
      bitmarkOptions = next && Object.freeze({ ...next });
      for (const c of controls) c.bitmarkOptionsChanged();
    },
    on: (event, listener) => {
      listeners[event].add(listener as never);
      return () => listeners[event].delete(listener as never);
    },
    openView: (viewOptions, listener) => sessionDocument.openView(viewOptions, listener),
    register: (c) => {
      controls.push(c);
      // The schema is for the JSON panes: fetched with the first one (PLAN-036 D1).
      if (c.pane.type === 'json') ensureSchema();
      c.applyTheme(theme);
      if (engine) c.engineChanged();
      else if (engineError) c.showEngineError(engineError);
      else c.render();
      return () => {
        // Before the pane's text goes with it.
        settleLastEdit(c);
        const i = controls.indexOf(c);
        if (i !== -1) controls.splice(i, 1);
      };
    },
    edit: (c, text, changes) => {
      // An edit that waits out the debounce behind another of the same pane
      // takes that one's changes with its own.
      const p = pending;
      pending = {
        c,
        text,
        changes: p?.c === c && 'text' in p ? chained(p.changes, p.text, changes) : changes,
      };
      flush();
    },
    commitEdit: (c, converted, content, changes) => {
      // As any edit: it waits out the debounce, and the last one wins. A
      // conversion of an earlier edit still in flight is dropped.
      editSeq++;
      const p = pending;
      pending = {
        c,
        converted,
        content,
        changes:
          p?.c === c && 'converted' in p ? chained(p.changes, p.converted, changes) : changes,
      };
      flush();
    },
    failEdit: (c, error) => {
      // As any edit: it waits out the debounce, and the last one wins, so a
      // text that does not convert while it is being typed is not reported.
      editSeq++;
      pending = { c, error };
      flush();
    },
    reportError: (c, error) => emit('error', { error, pane: c?.pane }),
    dispose: () => {
      disposed = true;
      flush.cancel();
      offFeature?.();
      sessionDocument.dispose();
      for (const c of [...controls]) c.pane.dispose();
      monacoTheme?.dispose();
      for (const set of Object.values(listeners)) set.clear();
    },
  };

  ready.then(
    (e) => {
      if (disposed) return;
      engine = e;
      stage2Pending = resolved.loading && !e.markupFormats;
      offFeature = e.onFeatureChange(() => {
        stage2Pending = false;
        sessionDocument.open(e, bitmark, version);
        for (const c of controls) c.engineChanged();
      });
      sessionDocument.open(e, bitmark, version);
      for (const c of controls) c.engineChanged();
      emit('ready', e);
    },
    (err: unknown) => {
      stage2Pending = false;
      if (disposed) return;
      const error = err instanceof Error ? err : new Error(String(err));
      engineError = error;
      log.error('the bitmark engine failed to load', err);
      for (const c of controls) c.showEngineError(error);
      emit('error', { error, pane: undefined });
    },
  );
  // A stage-2 failure ends "loading": the markup panes say they need the full parser.
  resolved.stage2?.catch(() => {
    if (disposed || !stage2Pending) return;
    stage2Pending = false;
    for (const c of controls) c.engineChanged();
  });

  // The JSON schema for the session's JSON panes (D2): the host's, or the
  // one the engine's own version publishes. A session that never shows a JSON
  // pane never fetches it.
  const bindSchema = async (e: BitmarkEngine) => {
    if (options.schema === false) return;
    let schema = options.schema;
    if (schema === undefined || typeof schema === 'string') {
      const url =
        typeof schema === 'string'
          ? schema
          : resolved.url
            ? schemaUrlFor(resolved.url)
            : schemaUrlForVersion(e.version);
      schema = await loadBitmarkJsonSchema(url);
    }
    if (schema !== undefined && !disposed) bindBitmarkJsonSchema(monaco, schema);
  };
  let schemaBound: Promise<void> | undefined;
  /** Bind the schema once, when a JSON pane first needs it (PLAN-036 D1). */
  const ensureSchema = () => {
    schemaBound ??= ready.then(bindSchema, () => undefined);
  };

  return session;
};

export type { BitmarkTheme };
