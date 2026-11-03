import type * as MonacoApi from 'monaco-editor';

import { createTextEditor } from '../editor/textEditor.js';
import { createLatestRunner, SUPERSEDED } from '../engine/latest.js';
import type { Anchor, BitmarkEngine } from '../engine/types.js';
import { attachBitmarkEditor, BitmarkEditorServices } from '../monaco/attach.js';
import { BITMARK_LANGUAGE_ID } from '../monaco/setup.js';
import { snapAnchorKeys } from '../scroll/anchorKeys.js';
import { attachBitMarkers, BitMarkers } from '../scroll/bitMarkers.js';
import { liveBitmarkAnchors } from '../scroll/liveBitmarkAnchors.js';
import type { AnchorList, MatchRange, ScrollSyncMember } from '../scroll/scrollSyncGroup.js';
import { createSplitBitStarts, SplitBitStarts } from '../scroll/splitBitStarts.js';
import { offsetMap } from '../scroll/textChange.js';
import type { SessionInternals } from '../session/types.js';
import type {
  BitmarkPane,
  BitmarkSession,
  PaneControl,
  PaneType,
  ToBitmarkResult,
} from '../session/types.js';
import { AppliedTheme, applyBitmarkTheme } from '../theme/applyTheme.js';
import { blockEnd } from './blockEnd.js';
import { injectPaneCss } from './styles.js';

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
   * Text in this pane → bitmark, and where each bit starts in the text
   * (pinned in the pane, so typed text links its scrolling by bit).
   */
  toBitmark?(engine: BitmarkEngine, text: string): Promise<ToBitmarkResult>;
  /** Regenerate the pane's text from the session. */
  fromSession?(
    engine: BitmarkEngine,
    session: SessionInternals,
  ): Promise<{ text: string; bitStarts?: readonly number[]; anchors?: readonly Anchor[] }>;
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
  /** After each regeneration that is shown: how long it took (e.g. for a host's timing display). */
  onRender?: (info: { durationMs: number }) => void;
}

/** Marker owner for a failed conversion of the edited pane (D15). */
export const CONVERT_MARKER_OWNER = 'bitmark-convert';

const DEFAULT_EDITOR_OPTIONS: MonacoApi.editor.IStandaloneEditorConstructionOptions = {
  wordWrap: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
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
    onInput: (text) => {
      if (readOnly) return;
      // The user's own text now wins: drop any catch-up waiting for blur.
      pending = false;
      s.edit(control, text);
    },
  });
  const { editor, model } = textEditor;

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
    text: '',
    version: -1,
    bitmark: '',
  };
  const anchors = (): AnchorList => {
    const version = editor.getModel()?.getVersionId() ?? -1;
    if (anchored.list.length > 0 && version !== anchored.version) {
      const text = textEditor.getValue();
      const move = offsetMap(anchored.text, text);
      anchored = {
        ...anchored,
        list: anchored.list.map((a) => ({ ...a, offset: move(a.offset) })),
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
  // The bitmark pane's anchors: keys onto the text being typed (PLAN-029 R5).
  const bitmarkAnchors = liveBitmarkAnchors(
    () => editor.getModel()?.getVersionId() ?? -1,
    () => textEditor.getValue(),
    () => s.getBitmark(),
  );
  // Where the linked panes are matched (PLAN-028 D7), and the block matching
  // the cursor in another pane (D8).
  const guide = document.createElement('div');
  guide.className = 'bm-pane-sync-line';
  guide.hidden = true;
  host.appendChild(guide);
  const matched = editor.createDecorationsCollection();
  /** Where the guide line is, when this pane is linked; drawn while `syncLine` is on. */
  let syncFraction: number | undefined;
  /** The block matching the cursor; highlighted while `syncMatch` is on. */
  let lastMatch: MatchRange | undefined;
  const drawGuide = () => {
    guide.hidden = !s.syncLine || syncFraction === undefined;
    if (!guide.hidden) {
      guide.style.top = `${Math.round(syncFraction! * editor.getLayoutInfo().height)}px`;
    }
  };
  const syncView = {
    onSyncLine: (fraction: number | undefined) => {
      syncFraction = fraction;
      drawGuide();
    },
    onMatch: (range: MatchRange | undefined) => {
      lastMatch = range;
      const m = editor.getModel();
      if (!range || !m || !s.syncMatch) {
        matched.clear();
        return;
      }
      const from = m.getPositionAt(range.start);
      const end = blockEnd(m, range.start, range.end);
      // A block that starts its line is shown as whole lines; one that starts
      // partway along (an element in a line of markup) as exactly its text.
      if (from.column > m.getLineFirstNonWhitespaceColumn(from.lineNumber)) {
        const to = m.getPositionAt(Math.max(range.start, end));
        matched.set([
          {
            range: {
              startLineNumber: from.lineNumber,
              startColumn: from.column,
              endLineNumber: to.lineNumber,
              endColumn: to.column,
            },
            options: { className: 'bm-sync-match' },
          },
        ]);
        return;
      }
      const first = from.lineNumber;
      const last = Math.max(first, m.getPositionAt(Math.max(range.start, end - 1)).lineNumber);
      matched.set([
        {
          range: { startLineNumber: first, startColumn: 1, endLineNumber: last, endColumn: 1 },
          options: { isWholeLine: true, className: 'bm-sync-match' },
        },
      ]);
    },
  };
  if (spec.scroll === 'split') {
    split = createSplitBitStarts(
      editor,
      () => s.engine,
      () => link.member?.invalidate(),
    );
    link.member = s.scrollGroup.join(editor, () => split!.bitStarts(), {
      linked: options.scrollSync ?? true,
      anchors: () => bitmarkAnchors,
      ...syncView,
    });
  } else if (spec.scroll === 'pinned') {
    markers = attachBitMarkers(monaco, editor, () => link.member?.invalidate());
    link.member = s.scrollGroup.join(editor, () => markers!.bitStarts(), {
      linked: options.scrollSync ?? true,
      anchors,
      ...syncView,
    });
  }

  const regenerate = createLatestRunner(async (engine: BitmarkEngine) => {
    const started = performance.now();
    const out = await spec.fromSession!(engine, s);
    return { ...out, durationMs: performance.now() - started };
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

  const render = (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
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
    const version = s.version;
    regenerate(engine).then(
      (out) => {
        if (out === SUPERSEDED || version !== s.version || disposed) return;
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
        options.onRender?.({ durationMs: out.durationMs });
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
    render();
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
      blurListener?.dispose();
      services?.dispose();
      split?.dispose();
      markers?.dispose();
      link.member?.dispose();
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
        realignAnchors();
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
    // A switch only redraws: scrolling and the match itself are untouched.
    syncViewChanged: () => {
      drawGuide();
      syncView.onMatch(lastMatch);
    },
  } satisfies PaneControl);

  // The session sets the first state: rendered, its engine error, or loading.
  const unregister = s.register(control);
  return pane;
};

export { BITMARK_LANGUAGE_ID };
