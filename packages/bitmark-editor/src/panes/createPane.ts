import type * as MonacoApi from 'monaco-editor';

import { createTextEditor } from '../editor/textEditor.js';
import { createLatestRunner, SUPERSEDED } from '../engine/latest.js';
import { withParseMs } from '../engine/parseTime.js';
import type { Anchor, BitmarkEngine, EngineViewOptions } from '../engine/types.js';
import { attachBitmarkEditor, BitmarkEditorServices } from '../monaco/attach.js';
import { JSON_SCHEMA_MAX_LINES, setBitmarkJsonSchemaApplies } from '../monaco/jsonSchema.js';
import { BITMARK_LANGUAGE_ID } from '../monaco/setup.js';
import { snapAnchorKeys } from '../scroll/anchorKeys.js';
import { attachBitMarkers, BitMarkers } from '../scroll/bitMarkers.js';
import { liveBitmarkAnchors } from '../scroll/liveBitmarkAnchors.js';
import type { AnchorList, ScrollSyncMember } from '../scroll/scrollSyncGroup.js';
import { createSplitBitStarts, SplitBitStarts } from '../scroll/splitBitStarts.js';
import { moveOffset, offsetMap } from '../scroll/textChange.js';
import type { SessionView, SessionViewUpdate } from '../session/sessionDocument.js';
import type { SessionInternals } from '../session/types.js';
import type {
  BitmarkPane,
  BitmarkSession,
  BitmarkWritingOptions,
  PaneControl,
  PaneType,
  ToBitmarkResult,
} from '../session/types.js';
import { AppliedTheme, applyBitmarkTheme } from '../theme/applyTheme.js';
import { attachSourceDocument, SourceDocument } from './sourceDocument.js';
import { injectPaneCss } from './styles.js';
import { attachSyncView } from './syncView.js';

/** What one pane type does (the per-type part of a pane). */
export interface PaneSpec {
  type: PaneType;
  language: string;
  extension: string;
  /** The parser `inputFormat` of this pane's text (for the mapping report). */
  inputFormat: string;
  /** False: always read-only (Text, Info, Mappings). */
  editable: boolean;
  /** How the pane's bit starts are known; `none`: not in scroll sync (Info, Mappings). */
  scroll: 'split' | 'pinned' | 'none';
  /** The bitmark editor services (highlighting, diagnostics, completion, hover). */
  services?: boolean;
  /** Needs the `full` variant's markup formats (D1). */
  needsMarkup?: boolean;
  /**
   * Text in this pane → bitmark, written as the session's `bitmarkOptions`
   * say (PLAN-046), and where each bit starts in the text (pinned in the
   * pane, so typed text links its scrolling by bit).
   */
  toBitmark?(
    engine: BitmarkEngine,
    text: string,
    writing: BitmarkWritingOptions | undefined,
  ): Promise<ToBitmarkResult>;
  /**
   * Regenerate the pane's text from the session. `parseMs`: the parser's
   * time for it, where the engine told it (PLAN-044).
   */
  fromSession?(
    engine: BitmarkEngine,
    session: SessionInternals,
  ): Promise<{
    text: string;
    bitStarts?: readonly number[];
    anchors?: readonly Anchor[];
    parseMs?: number;
  }>;
  /**
   * The pane's text as a view of the session's document (PLAN-035 D6): the
   * same text as `fromSession` gives, kept up to date by edits while the
   * engine has documents.
   */
  view?: EngineViewOptions;
  /** Where an anchor at `offset` of the view's `text` is shown from (as `fromSession` reports its anchors). */
  viewAnchor?(text: string, offset: number): number;
  /**
   * The pane's own text as a document with a bitmark view (PLAN-035 D7): an
   * edit here reaches the bitmark as the parser's edits, where `toBitmark`
   * converts the whole text.
   */
  source?: { inputFormat: string; view: EngineViewOptions };
}

export interface PaneOptions {
  /** Read-only (switchable later). Text, Info and Mappings are always read-only. */
  readOnly?: boolean;
  /** Take part in the session's scroll linking (default true, false for Info / Mappings). */
  scrollSync?: boolean;
  /** Passed to `monaco.editor.create`. */
  editorOptions?: MonacoApi.editor.IStandaloneEditorConstructionOptions;
  /** Also show this pane's error here: an element (its text), or a callback (D12). */
  errorSlot?: HTMLElement | ((message: string | undefined) => void);
  /** The pane's label (ARIA, mapping report). Default: the session's messages. */
  label?: string;
  /**
   * After each regeneration that is shown: how long the parser took for it,
   * in milliseconds (PLAN-044). The parser's time and nothing else, also
   * from a worker engine; the panes that follow the session's document by
   * edits report the same time for one change, which one parse serves. Where
   * the engine does not tell the parser's time (the Info and Mappings panes,
   * a host's own engine), it is how long the pane's calls took.
   */
  onRender?: (info: { parseMs: number }) => void;
}

/** Marker owner for a failed conversion of the edited pane (D15). */
export const CONVERT_MARKER_OWNER = 'bitmark-convert';

const DEFAULT_EDITOR_OPTIONS: MonacoApi.editor.IStandaloneEditorConstructionOptions = {
  wordWrap: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  // No colour swatches (PLAN-038 D1). For them Monaco asks its JSON worker,
  // on every change, for each schema match in the whole document: 9 ms a bit
  // with the bitmark schema, and on a large document the worker runs out of
  // stack ("Maximum call stack size exceeded").
  colorDecorators: false,
  // Text is pasted as it is (PLAN-038 D2). With "paste as" on, Monaco starts
  // a cancellable operation for every paste and rejects the one before it,
  // unhandled ("Uncaught (in promise) Canceled").
  pasteAs: { enabled: false },
  // Typographic quotes, dashes and the like are what a book's text is made
  // of, not look-alikes to warn about (PLAN-038 D4): no boxes around them and
  // no banner "This document contains many ambiguous unicode characters".
  unicodeHighlight: { ambiguousCharacters: false },
};

/**
 * A pane: one Monaco editor showing the session's document in one format,
 * mounted inside `element` (PLAN-022 D9). Editing it updates every other
 * pane; it regenerates when another pane is edited.
 */
export const createPane = (
  element: HTMLElement,
  session: BitmarkSession,
  spec: PaneSpec,
  options: PaneOptions = {},
): BitmarkPane => {
  const s = session as SessionInternals;
  const { monaco, messages } = s;
  injectPaneCss();
  const label = options.label ?? messages.labels[spec.type];

  const container = document.createElement('div');
  container.className = `bm-pane bm-pane-${spec.type}`;
  const banner = document.createElement('div');
  banner.className = 'bm-pane-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');
  banner.hidden = true;
  const host = document.createElement('div');
  host.className = 'bm-pane-editor';
  container.append(banner, host);
  element.appendChild(container);

  let readOnly = !spec.editable || !!options.readOnly;
  // Banner precedence: the edited pane's own error, a failed regeneration,
  // stale, a notice (loading / needs the full parser).
  const state: { sourceError?: string; renderError?: string; stale: boolean; notice?: string } = {
    stale: false,
  };
  const showBanner = () => {
    const error = state.sourceError ?? state.renderError;
    const text = error
      ? `${messages.errorPrefix}${error}`
      : state.stale
        ? messages.stale
        : state.notice;
    banner.textContent = text ?? '';
    banner.hidden = !text;
    container.classList.toggle('bm-stale', state.stale);
    const slot = options.errorSlot;
    if (typeof slot === 'function') slot(error);
    else if (slot) {
      slot.textContent = error ?? '';
      slot.hidden = !error;
    }
  };

  const control: PaneControl = {} as PaneControl;
  const textEditor = createTextEditor(host, {
    monaco,
    value: spec.type === 'bitmark' ? s.getBitmark() : '',
    language: spec.language,
    kind: spec.type,
    extension: spec.extension,
    readOnly,
    editorOptions: {
      ...DEFAULT_EDITOR_OPTIONS,
      ...(spec.type === 'bitmark' ? {} : { stickyScroll: { enabled: false } }),
      ariaLabel: label,
      ...options.editorOptions,
    },
    onInput: (text, changes) => {
      if (readOnly) return;
      // The user's own text now wins: drop any catch-up waiting for blur.
      pending = false;
      viewShown = -1;
      s.edit(control, text, changes);
    },
    onEdit: (event) => {
      if (readOnly || !source) return false;
      if (!source.edit(event)) return false;
      pending = false;
      // Whether or not the edit converts: the view's edits no longer apply to this text.
      viewShown = -1;
      moveAnchors(event);
      return true;
    },
    onReplaced: () => source?.drop(),
  });
  const { editor, model } = textEditor;

  // A large JSON document is not checked against the schema (PLAN-039 D2).
  let schemaSize: MonacoApi.IDisposable | undefined;
  if (spec.type === 'json') {
    const uri = model.uri.toString();
    const apply = () =>
      setBitmarkJsonSchemaApplies(monaco, uri, model.getLineCount() <= JSON_SCHEMA_MAX_LINES);
    apply();
    const listener = model.onDidChangeContent(apply);
    schemaSize = {
      dispose: () => {
        listener.dispose();
        setBitmarkJsonSchemaApplies(monaco, uri, true);
      },
    };
  }

  let services: BitmarkEditorServices | undefined;
  if (spec.services) {
    services = attachBitmarkEditor(monaco, editor, s.engine, { diagnostics: !readOnly });
  }

  // Scroll linking (D9): split panes from the engine, pinned panes from
  // the positions the conversion recorded.
  const link: { member?: ScrollSyncMember } = {};
  let split: SplitBitStarts | undefined;
  let markers: BitMarkers | undefined;
  /**
   * The bit anchors of this pane (PLAN-028 D4): offsets into `text` keyed by
   * offsets into `bitmark`, the texts they were given for. An edit here, or
   * a new bitmark (from an edit here, or typed in the bitmark pane before
   * this pane regenerates), moves them with the text when they are next
   * read (D5).
   */
  let anchored = {
    list: [] as AnchorList,
    /** The text the offsets are in; `undefined`: not kept (the anchors were moved by the edits themselves). */
    text: '' as string | undefined,
    version: -1,
    bitmark: '',
  };
  const anchors = (): AnchorList => {
    const version = editor.getModel()?.getVersionId() ?? -1;
    if (anchored.list.length > 0 && version !== anchored.version) {
      const text = textEditor.getValue();
      // Without the text they were in, they cannot be moved: the pane then links by its bits.
      const move = anchored.text === undefined ? undefined : offsetMap(anchored.text, text);
      anchored = {
        ...anchored,
        list: move ? anchored.list.map((a) => ({ ...a, offset: move(a.offset) })) : [],
        text,
        version,
      };
    }
    const bitmark = s.getBitmark();
    if (anchored.list.length > 0 && bitmark !== anchored.bitmark) {
      const move = offsetMap(anchored.bitmark, bitmark);
      anchored = {
        ...anchored,
        list: anchored.list.map((a) => ({ ...a, key: move(a.key) })),
        bitmark,
      };
    }
    return anchored.list;
  };
  /**
   * The anchors moved by an edit of the user's, as Monaco reports it (PLAN-035
   * D7): no reading and comparing of the pane's whole text.
   */
  const moveAnchors = (event: MonacoApi.editor.IModelContentChangedEvent) => {
    if (anchored.list.length === 0) return;
    // Up to date with the text before this edit, or not movable this way.
    // The event's own version: the changes of one operation arrive together.
    const before = event.versionId - 1;
    if (anchored.version !== before || event.isFlush) {
      anchored = { ...anchored, list: [], text: undefined, version: before + 1 };
      return;
    }
    // In the order given, each in the text the one before left: Monaco tells
    // the changes of one operation from the last to the first.
    let list = anchored.list;
    for (const c of event.changes) {
      const change = {
        start: c.rangeOffset,
        oldEnd: c.rangeOffset + c.rangeLength,
        newEnd: c.rangeOffset + c.text.length,
      };
      list = list.map((a) => ({ ...a, offset: moveOffset(a.offset, change) }));
    }
    anchored = { ...anchored, list, text: undefined, version: before + 1 };
  };
  // The pane's own text as a document (PLAN-035 D7): made below, once the control exists.
  let source: SourceDocument | undefined;
  // The bitmark pane's anchors: keys onto the text being typed (PLAN-029 R5).
  const bitmarkAnchors = liveBitmarkAnchors(
    () => editor.getModel()?.getVersionId() ?? -1,
    () => textEditor.getValue(),
    () => s.getBitmark(),
  );
  // Where the linked panes are matched (PLAN-028 D7), and the block matching
  // the cursor in another pane (D8), drawn while the session's switches are on.
  const syncView = attachSyncView(editor, host, {
    syncLine: () => s.syncLine,
    syncMatch: () => s.syncMatch,
  });
  if (spec.scroll === 'split') {
    split = createSplitBitStarts(
      editor,
      () => s.engine,
      () => link.member?.invalidate(),
    );
    link.member = s.scrollGroup.join(editor, () => split!.bitStarts(), {
      linked: options.scrollSync ?? true,
      anchors: () => bitmarkAnchors,
      onSyncLine: syncView.onSyncLine,
      onMatch: syncView.onMatch,
    });
  } else if (spec.scroll === 'pinned') {
    markers = attachBitMarkers(monaco, editor, () => link.member?.invalidate());
    link.member = s.scrollGroup.join(editor, () => markers!.bitStarts(), {
      linked: options.scrollSync ?? true,
      anchors,
      onSyncLine: syncView.onSyncLine,
      onMatch: syncView.onMatch,
    });
  }

  const regenerate = createLatestRunner(async (engine: BitmarkEngine) => {
    const { value, parseMs } = await withParseMs(() => spec.fromSession!(engine, s));
    return { ...value, parseMs };
  });

  /**
   * The anchors of the text this pane would show for the new document,
   * moved onto the user's own text, which it keeps (PLAN-028 D5): that text
   * is the regenerated one with the user's edits, so the two differ only
   * there. Run after an edit here is committed.
   */
  const realign = createLatestRunner(async (engine: BitmarkEngine) => spec.fromSession!(engine, s));
  const realignAnchors = () => {
    const engine = s.engine;
    if (!spec.fromSession || !engine || !link.member) return;
    const version = s.version;
    realign(engine).then(
      (out) => {
        if (out === SUPERSEDED || version !== s.version || disposed || !isSource) return;
        if (out.anchors === undefined) return;
        const text = textEditor.getValue();
        const move = offsetMap(out.text, text);
        anchored = {
          list: snapAnchorKeys(s.getBitmark(), out.anchors).map((a) => ({
            key: a.input,
            offset: move(a.output),
            end: a.end,
          })),
          text,
          version: editor.getModel()?.getVersionId() ?? -1,
          bitmark: s.getBitmark(),
        };
        link.member?.invalidate();
      },
      () => undefined,
    );
  };

  /**
   * This pane made the document's current text (it was the last edit's
   * source): it keeps the user's text verbatim and does not catch up later.
   */
  let isSource = false;
  /** A regeneration the focused editor could not take: applied on blur. */
  let pending = false;

  /** Show regenerated `text`; true when the editor took it. */
  const show = (text: string, force: boolean): boolean => {
    const applied = textEditor.setValue(text, { force });
    if (applied) {
      isSource = false;
      // The text is now the document's again: any earlier error is gone (D15).
      if (state.sourceError !== undefined) clearSourceError();
    } else if (!isSource) {
      pending = true;
    }
    return applied;
  };

  /**
   * The pane as a view of the session's document (PLAN-035 D6). `viewShown`:
   * the session version whose view output the editor shows, exactly (-1:
   * some other text). An update's edits apply only to that text; otherwise
   * the view sends its whole output again.
   */
  let view: SessionView | undefined;
  let viewShown = -1;
  let viewText = '';
  /** The whole output was asked for again: edits are skipped until it comes. */
  let resyncing = false;
  /** The session version this pane's own edit made (it keeps the user's text for it). */
  let sourceVersion = -1;
  /** The whole output asked for is an API change's: shown even where the user has focus. */
  let resyncForce = false;
  const resyncView = (force = false) => {
    resyncForce ||= force;
    if (resyncing) return;
    resyncing = true;
    viewShown = -1;
    view?.resync();
  };
  /**
   * The view's output is not followed (D1a): its offsets and edits are
   * places in the text as the parser wrote it, and the pane's model, whose
   * line ends are LF, would not hold a text with CRLF in it as it is. The
   * pane converts the whole text instead, as without a view, until another
   * document is set.
   */
  let viewRefused = false;
  const onViewUpdate = (update: SessionViewUpdate) => {
    if (disposed) return;
    if (
      update.output?.includes('\r\n') ||
      update.edits.some((edit) => edit.newText.includes('\r\n'))
    ) {
      // An API change is shown also where the user has focus, by the whole conversion too.
      const force = update.force || resyncForce;
      viewRefused = true;
      followView();
      render({ force }, false);
      return;
    }
    const whole = update.output !== undefined;
    // An API change is the new document: an edit of this pane still being converted is not.
    if (update.force) source?.drop();
    const force = update.force || (whole && resyncForce);
    if (whole) {
      resyncing = false;
      resyncForce = false;
    } else if (resyncing) {
      resyncForce ||= update.force;
      return;
    }
    // This pane's own edit made the version: it keeps the user's text.
    if (update.version === sourceVersion && !force) {
      viewShown = -1;
      return;
    }
    if (!whole && update.base !== viewShown) {
      resyncView(update.force);
      return;
    }
    if (editor.hasTextFocus() && !force) {
      // Not overwritten while the user works here: it catches up on blur.
      viewShown = -1;
      pending = true;
      state.notice = undefined;
      state.renderError = undefined;
      state.stale = false;
      showBanner();
      return;
    }
    if (whole) {
      textEditor.setValue(update.output!, { force: true });
      viewText = update.output!;
    } else if (update.edits.length > 0) {
      viewText = textEditor.applyEdits(update.edits, viewText);
    }
    viewShown = update.version;
    isSource = false;
    pending = false;
    if (state.sourceError !== undefined) clearSourceError();
    state.notice = undefined;
    state.renderError = undefined;
    state.stale = false;
    const anchorAt = spec.viewAnchor;
    anchored = {
      list: snapAnchorKeys(update.bitmark, update.anchors ?? []).map((a) => ({
        key: a.input,
        offset: anchorAt ? anchorAt(viewText, a.output) : a.output,
        end: a.end,
      })),
      text: viewText,
      version: editor.getModel()?.getVersionId() ?? -1,
      bitmark: update.bitmark,
    };
    if (update.bitStarts) markers?.set(update.bitStarts);
    showBanner();
    options.onRender?.({ parseMs: update.parseMs });
  };

  /**
   * The view is held while the pane can show it: a markup pane waits for
   * the engine's markup formats, as its whole conversion does.
   */
  const followView = () => {
    const wanted = !!spec.view && !viewRefused && !(spec.needsMarkup && !s.engine?.markupFormats);
    if (wanted === (view !== undefined)) return;
    if (!wanted) {
      view!.dispose();
      view = undefined;
      viewShown = -1;
      resyncing = false;
      resyncForce = false;
      return;
    }
    view = s.openView(spec.view!, {
      update: onViewUpdate,
      // No view (any more): the whole text is converted, as without one.
      lost: () => {
        if (disposed) return;
        viewShown = -1;
        resyncing = false;
        render();
      },
    });
  };

  const render = (opts?: { force?: boolean }, retryView = true) => {
    const force = !!opts?.force;
    // Another document: its view is tried again, and shown as an API change is.
    if (force && viewRefused && retryView) {
      viewRefused = false;
      followView();
      resyncForce = view !== undefined;
    }
    if (spec.type === 'bitmark') {
      show(s.getBitmark(), force);
      state.stale = false;
      showBanner();
      return;
    }
    const engine = s.engine;
    if (!engine) {
      state.notice = messages.loading;
      showBanner();
      return;
    }
    if (spec.needsMarkup && !engine.markupFormats) {
      state.notice = s.engineStage2Pending ? messages.loading : messages.needsFullParser;
      showBanner();
      return;
    }
    // Its text comes from the session's document, as the view's updates.
    if (view?.expected) return;
    const version = s.version;
    regenerate(engine).then(
      (out) => {
        if (out === SUPERSEDED || version !== s.version || disposed || view?.expected) return;
        state.notice = undefined;
        state.renderError = undefined;
        state.stale = false;
        if (show(out.text, force)) {
          anchored = {
            list: snapAnchorKeys(s.getBitmark(), out.anchors ?? []).map((a) => ({
              key: a.input,
              offset: a.output,
              end: a.end,
            })),
            text: out.text,
            version: editor.getModel()?.getVersionId() ?? -1,
            bitmark: s.getBitmark(),
          };
          markers?.pin(out.text, out.bitStarts);
        }
        showBanner();
        options.onRender?.({ parseMs: out.parseMs });
      },
      (err: unknown) => {
        if (disposed) return;
        const error = err instanceof Error ? err : new Error(String(err));
        // Keep the last good text; say it is out of date (D15).
        state.notice = undefined;
        state.renderError = error.message;
        state.stale = true;
        showBanner();
        s.reportError(control, error);
      },
    );
  };

  let theme: AppliedTheme | undefined;
  let disposed = false;

  const blurListener = editor.onDidBlurEditorText?.(() => {
    if (!pending || disposed) return;
    pending = false;
    if (view?.expected) resyncView();
    else render();
  });

  const clearSourceError = () => {
    state.sourceError = undefined;
    monaco.editor.setModelMarkers(model, CONVERT_MARKER_OWNER, []);
  };

  const pane: BitmarkPane = {
    type: spec.type,
    element: container,
    textEditor,
    get readOnly() {
      return readOnly;
    },
    get scrollSync() {
      return link.member?.linked ?? false;
    },
    setReadOnly: (next) => {
      readOnly = !spec.editable || next;
      textEditor.setReadOnly(readOnly);
    },
    setScrollSync: (on) => link.member?.setLinked(on),
    layout: () => textEditor.layout(),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unregister();
      view?.dispose();
      source?.dispose();
      blurListener?.dispose();
      schemaSize?.dispose();
      services?.dispose();
      split?.dispose();
      markers?.dispose();
      link.member?.dispose();
      syncView.dispose();
      theme?.dispose();
      textEditor.dispose();
      container.remove();
    },
  };

  Object.assign(control, {
    pane,
    inputFormat: spec.inputFormat,
    label,
    toBitmark: spec.toBitmark,
    pinInput: (text: string, inputStarts: readonly number[] | undefined) =>
      markers?.pin(text, inputStarts),
    render,
    engineChanged: () => {
      services?.setEngine(s.engine);
      split?.refresh();
      source?.drop();
      viewRefused = false;
      followView();
      render();
    },
    showEngineError: (error: Error) => {
      state.notice = `${messages.errorPrefix}${error.message}`;
      showBanner();
    },
    showSourceError: (error: Error | undefined) => {
      // A committed edit (no error) makes this pane the document's source.
      if (!error) {
        isSource = true;
        pending = false;
        sourceVersion = s.version;
        viewShown = -1;
        // With its own document, the anchors moved with the edit itself.
        if (!source?.active) realignAnchors();
      }
      state.sourceError = error?.message;
      // A JSON syntax error is marked by Monaco's JSON language already.
      const convertMarkers =
        error && error.name !== 'SyntaxError'
          ? [
              {
                severity: monaco.MarkerSeverity.Error,
                message: error.message,
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: 1,
                endColumn: model.getLineMaxColumn?.(1) ?? 2,
              },
            ]
          : [];
      monaco.editor.setModelMarkers(model, CONVERT_MARKER_OWNER, convertMarkers);
      if (!error) {
        state.stale = false;
      }
      showBanner();
    },
    setStale: (stale: boolean) => {
      state.stale = stale;
      showBanner();
    },
    applyTheme: (next: Parameters<PaneControl['applyTheme']>[0]) => {
      theme?.dispose();
      theme = next === undefined ? undefined : applyBitmarkTheme(container, next);
    },
    syncViewChanged: () => syncView.refresh(),
    // The pane's own document writes its bitmark the new way from here on.
    bitmarkOptionsChanged: () => source?.reopenView(),
  } satisfies PaneControl);

  if (spec.source) {
    const { inputFormat, view: bitmarkView } = spec.source;
    // The bitmark it makes is written as the session says (PLAN-046 D2).
    const ownSpec = { inputFormat, view: () => ({ ...s.bitmarkOptions, ...bitmarkView }) };
    source = attachSourceDocument(model, () => s.engine, ownSpec, {
      converted: (bitmark, inputStarts, changes) => {
        if (disposed) return;
        s.commitEdit(control, bitmark, () => textEditor.getValue(), changes);
        if (inputStarts) markers?.set(inputStarts);
      },
      failed: (error) => {
        if (!disposed) s.failEdit(control, error);
      },
      // No documents (any more): the whole text is converted, as without one.
      lost: () => {
        if (!disposed && !readOnly) s.edit(control, textEditor.getValue());
      },
    });
  }
  followView();
  // The session sets the first state: rendered, its engine error, or loading.
  const unregister = s.register(control);
  return pane;
};

export { BITMARK_LANGUAGE_ID };
