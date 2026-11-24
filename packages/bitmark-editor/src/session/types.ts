import type { EditChanges, TextEditor } from '../editor/textEditor.js';
import type {
  BitmarkEngine,
  Feature,
  LoadBitmarkEngineOptions,
  RawParserModule,
} from '../engine/index.js';
import type { EngineViewOptions } from '../engine/types.js';
import type { Monaco } from '../monaco/types.js';
import type { ScrollSyncGroup } from '../scroll/scrollSyncGroup.js';
import type { BitmarkTheme } from '../theme/applyTheme.js';
import type { SessionView, SessionViewListener } from './sessionDocument.js';

/** Where an edit came from, for the mapping report (a host's own editor, say). */
export type EditOrigin = Omit<LastEdit, 'count'>;

/** The pane kinds (PLAN-022 D1, D9). */
export type PaneType = 'bitmark' | 'json' | 'html' | 'xml' | 'text' | 'info' | 'mappings';

/** The UI strings, all replaceable (PLAN-022 D12: the docs site has six locales). */
export interface BitmarkEditorMessages {
  loading: string;
  /** A markup pane on an engine without the markup formats (`bitmark-json`). */
  needsFullParser: string;
  /** A pane whose content no longer matches the document (D15). */
  stale: string;
  /** Before an error message in a pane's banner. */
  errorPrefix: string;
  /** Pane labels: the editors' ARIA labels and the mapping report's header. */
  labels: Record<PaneType, string>;
}

/**
 * How the session gets its parser (PLAN-022 D2, D7): an engine (or a promise
 * of one); a raw module the host already initialised, with the variant it
 * declared; or options to load one (the default: jsDelivr at the pinned
 * version).
 */
export type EngineSource =
  | BitmarkEngine
  | Promise<BitmarkEngine>
  | { module: RawParserModule; feature?: Feature }
  | LoadBitmarkEngineOptions;

/**
 * How bitmark made from another format is written (PLAN-046): the parser's
 * options for writing bitmark. One left out is the parser's default.
 */
export interface BitmarkWritingOptions {
  /**
   * Inline marks as toggle tags, `(+bold)text(-bold)`, or in the deprecated
   * legacy form, `==text==|bold|`. Parser 8 writes toggle tags when this is
   * left out; a parser before it, the legacy form.
   */
  inlineStyle?: 'toggle' | 'legacy';
}

export interface BitmarkSessionOptions {
  /** The Monaco to create the panes on (PLAN-022 D8): the host's, or the bundled one. */
  monaco: Monaco;
  engine?: EngineSource;
  /** The initial bitmark. */
  value?: string;
  /**
   * Wait for a pause in editing before converting (ms). Default 0: every
   * edit converts. One schedule for the whole
   * session, last edit wins (D12).
   */
  debounceMs?: number;
  theme?: BitmarkTheme;
  /** Set Monaco's (page-global) theme to match (D11). Default false. */
  applyMonacoTheme?: boolean;
  /**
   * The JSON schema: an object, a URL, or `false` for none. Default: beside
   * the loaded engine, or on the CDN at the engine's version.
   */
  schema?: unknown;
  /**
   * Join this scroll group instead of the session's own, so that a host's
   * own editors and the session's panes link together.
   */
  scrollGroup?: ScrollSyncGroup;
  /**
   * Draw the scroll-sync guide line in each linked pane, where they are
   * matched (PLAN-028 D7). Default true. Only linked panes have one.
   */
  syncLine?: boolean;
  /**
   * Highlight the block under the cursor, in its pane and the matching
   * block in the others (PLAN-028 D8), whether or not their scrolling is
   * linked. Default true.
   */
  syncMatch?: boolean;
  messages?: Partial<Omit<BitmarkEditorMessages, 'labels'>> & {
    labels?: Partial<Record<PaneType, string>>;
  };
  /**
   * How the session writes the bitmark it makes from an edit in another
   * pane (JSON, HTML, XML). Default: the parser's own. Changed later with
   * `setBitmarkOptions`.
   */
  bitmarkOptions?: BitmarkWritingOptions;
}

/** The window the user last edited — the mapping report's input (D1). */
export interface LastEdit {
  /** The parser `inputFormat` of that pane (`bitmark`, `json`, `html`, a mapping id). */
  inputFormat: string;
  /**
   * That pane's own text at the time of the edit. For an edit of a large
   * output pane it may be read from the pane when first asked for: take the
   * text when the edit is reported, not the object for later.
   */
  content: string;
  /** Its label, or "API" for `setBitmark`. */
  label: string;
  /** Counts every edit, even back to an earlier text. */
  count: number;
}

export interface SessionChange {
  bitmark: string;
  /** The pane the edit came from; `undefined` for `setBitmark`. */
  source: BitmarkPane | undefined;
}

export interface SessionError {
  error: Error;
  /** The pane whose edit failed, or whose regeneration failed. */
  pane: BitmarkPane | undefined;
  /**
   * The pane's own edit did not convert: its text is not in the document.
   * Not set when the pane could not be regenerated from the document.
   */
  edit?: boolean;
}

export interface SessionEvents {
  change: SessionChange;
  error: SessionError;
  ready: BitmarkEngine;
}

/** A pane, as the host holds it. */
export interface BitmarkPane {
  readonly type: PaneType;
  /** The pane's own element (inside the one the host gave). */
  readonly element: HTMLElement;
  readonly textEditor: TextEditor;
  readonly readOnly: boolean;
  readonly scrollSync: boolean;
  setReadOnly(readOnly: boolean): void;
  /** Join (true) or leave (false) the session's scroll linking (D9). */
  setScrollSync(on: boolean): void;
  layout(): void;
  dispose(): void;
}

export interface BitmarkSession {
  readonly monaco: Monaco;
  /** The engine, once it has loaded. */
  readonly engine: BitmarkEngine | undefined;
  /** Resolves with the engine; rejects if it cannot load. */
  readonly ready: Promise<BitmarkEngine>;
  readonly messages: BitmarkEditorMessages;
  getBitmark(): string;
  /**
   * Replace the document. By default it counts as a bitmark edit labelled
   * "API"; `origin` says where it really came from (for the mapping
   * report), and `false` says it is not an edit at all (the mapping report
   * keeps the last one).
   */
  setBitmark(text: string, origin?: EditOrigin | false): void;
  /**
   * The document as JSON text (computed on demand): exactly the JSON pane's
   * text, the parser's pretty JSON with parser 7.19 or later.
   */
  getJson(options?: { mode?: 'optimized' | 'full' }): Promise<string>;
  readonly lastEdit: LastEdit | undefined;
  panes(): readonly BitmarkPane[];
  /** Link exactly these panes' scrolling; every other pane scrolls alone (D9). */
  setScrollSync(panes: readonly BitmarkPane[]): void;
  /** Whether the scroll-sync guide line is drawn (`syncLine`). */
  readonly syncLine: boolean;
  setSyncLine(on: boolean): void;
  /** Whether the matching block is highlighted (`syncMatch`). */
  readonly syncMatch: boolean;
  setSyncMatch(on: boolean): void;
  /**
   * The group that links the panes' scrolling: the one passed as
   * `scrollGroup`, or the session's own. A host joins it to link a view of
   * its own, for example a rendered preview (PLAN-036 D2).
   */
  readonly scrollGroup: ScrollSyncGroup;
  setTheme(theme: BitmarkTheme): void;
  /** How the session writes bitmark made from another format (`bitmarkOptions`). */
  readonly bitmarkOptions: BitmarkWritingOptions | undefined;
  /**
   * Change how bitmark made from another format is written. The document
   * stays as it is: the next edit in a JSON, HTML or XML pane is written
   * the new way.
   */
  setBitmarkOptions(options: BitmarkWritingOptions | undefined): void;
  on<K extends keyof SessionEvents>(event: K, listener: (e: SessionEvents[K]) => void): () => void;
  dispose(): void;
}

/** What a pane needs from its session (not part of the public API). */
export interface SessionInternals extends BitmarkSession {
  readonly theme: BitmarkTheme | undefined;
  /** True while the session is loading its engine's stage 2 itself. */
  readonly engineStage2Pending: boolean;
  /** The bitmark version: +1 per committed edit. */
  readonly version: number;
  register(pane: PaneControl): () => void;
  /**
   * A view of the session's document for an output pane (PLAN-035 D6): the
   * pane's text arrives as edits, for as long as the engine has documents.
   */
  openView(options: EngineViewOptions, listener: SessionViewListener): SessionView;
  /**
   * A user edit in `pane`. `changes`: how the pane's text got there; used
   * where that text is the bitmark itself (PLAN-043 D2).
   */
  edit(pane: PaneControl, text: string, changes?: EditChanges): void;
  /**
   * A user edit in `pane` that its own document converted already (PLAN-035
   * D7): `bitmark` is the new document; `content` reads the pane's text;
   * `changes`: how the bitmark got there (PLAN-043 D3).
   */
  commitEdit(
    pane: PaneControl,
    bitmark: string,
    content: () => string,
    changes?: EditChanges,
  ): void;
  /** A user edit in `pane` whose text does not convert. */
  failEdit(pane: PaneControl, error: Error): void;
  reportError(pane: PaneControl | undefined, error: Error): void;
}

/** A pane's text converted to bitmark (main's PLAN-020). */
export interface ToBitmarkResult {
  bitmark: string;
  /** Where each bit starts in the pane's text; `undefined` when unknown. */
  inputStarts: readonly number[] | undefined;
}

/** The session's handle on a pane. */
export interface PaneControl {
  readonly pane: BitmarkPane;
  readonly inputFormat: string;
  readonly label: string;
  /**
   * Text in this pane → bitmark, written as `options` say. `undefined`: the
   * pane is bitmark already.
   */
  toBitmark?(
    engine: BitmarkEngine,
    text: string,
    options: BitmarkWritingOptions | undefined,
  ): Promise<ToBitmarkResult>;
  /** Pin where each bit starts in `text`, if the pane still shows it. */
  pinInput(text: string, inputStarts: readonly number[] | undefined): void;
  /**
   * Regenerate from the session's bitmark. `force`: even if the user has
   * focus here (an API change); otherwise a focused pane catches up on blur.
   */
  render(options?: { force?: boolean }): void;
  /** The engine failed to load: say so in the pane. */
  showEngineError(error: Error): void;
  /** Called when the engine arrives or changes variant. */
  engineChanged(): void;
  showSourceError(error: Error | undefined): void;
  setStale(stale: boolean): void;
  applyTheme(theme: BitmarkTheme | undefined): void;
  /** `syncLine` or `syncMatch` changed: draw or hide them. */
  syncViewChanged(): void;
  /** The session's `bitmarkOptions` changed. */
  bitmarkOptionsChanged(): void;
}
