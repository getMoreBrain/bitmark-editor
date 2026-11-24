import type * as Parser from '@gmb/bitmark-parser';
import type {
  BitEntry,
  BitSlice,
  CompletionItem,
  CompletionList,
  ContentChange,
  ConvertOptions,
  Diagnostics,
  Feature,
  Hover,
  InfoOptions,
  OutputMode,
  ParseOptions,
  Position,
  Range,
  SemanticTokens,
} from '@gmb/bitmark-parser';

export type { Feature };

/**
 * A raw `@gmb/bitmark-parser` module (or a compatible object). The editor
 * services and bit positions are optional: an older parser without them
 * leaves those features off, never an error.
 */
export interface RawParserModule {
  init?: typeof Parser.init;
  version: typeof Parser.version;
  bitmarkToObjects: typeof Parser.bitmarkToObjects;
  convert: typeof Parser.convert;
  semanticTokens: typeof Parser.semanticTokens;
  convertWithDetails?: typeof Parser.convertWithDetails;
  splitBits?: typeof Parser.splitBits;
  diagnostics?: typeof Parser.diagnostics;
  complete?: typeof Parser.complete;
  resolve?: typeof Parser.resolve;
  hover?: typeof Parser.hover;
  info?: typeof Parser.info;
  /** The incremental document (parser PLAN-271, 7.21+), in the variants that have it. */
  createDocument?: typeof Parser.createDocument;
}

/** JSON text written one bit at a time, with where each bit starts (UTF-16). */
export interface JsonText {
  text: string;
  bitStarts: number[];
  /**
   * How long the engine took to parse and write it, in milliseconds, where
   * it ran (PLAN-044 D2). Absent from an engine that does not time it.
   */
  parseMs?: number;
}

/** Converted output, with where each bit starts in it when the parser says. */
export interface OutputWithBitStarts {
  output: string;
  /** Where each bit starts in the output. */
  bitStarts: number[] | undefined;
  /**
   * Where each bit starts in the input (parser PLAN-223, 7.8+), for the pane
   * the user typed it in (main's PLAN-020). `undefined` from an older parser.
   */
  inputStarts: number[] | undefined;
  /**
   * Fixed points inside the bits (parser PLAN-266, 7.19+): where each block,
   * list item, divider and tag starts in the input (`input`) and where its
   * value starts in the output (`output`), ordered by `input`. Empty where
   * the parser reports none for the conversion (it does for bitmark → JSON,
   * HTML and XML);
   * `undefined` from an older parser.
   */
  anchors: Anchor[] | undefined;
  /**
   * How long the parser's own call took, in milliseconds (PLAN-044 D2):
   * taken where the parser runs, so from a worker engine it holds neither
   * the wait behind other calls nor the messages each way. Absent from an
   * engine that does not time it.
   */
  parseMs?: number;
}

/** One bit anchor (UTF-16 offsets). */
export interface Anchor {
  input: number;
  output: number;
  /** The bit's end: its last visible character and its value's end (the bit's last anchor). */
  end?: boolean;
}

/** What a view of a document writes (the parser's `ViewOptions`). */
export interface EngineViewOptions {
  /** `json`, `text` or a markup format. */
  outputFormat: string;
  mode?: OutputMode;
  pretty?: boolean;
  /** A bitmark view: how inline marks are written (parser 8; PLAN-046). */
  inlineStyle?: 'toggle' | 'legacy';
}

/** What changed in one view of a document (PLAN-035 D6; offsets in UTF-16). */
export interface EngineViewUpdate {
  /** The view's id. */
  view: number;
  /** The whole output: a view just opened, a replaced text, or a change the edits cannot express. */
  output?: string;
  /**
   * Otherwise the edits: ranges in the view's previous output, in order and
   * not overlapping, to apply together.
   */
  edits: readonly { range: Range; newText: string }[];
  /** Where each bit starts in the output now. */
  bitStarts: number[] | undefined;
  /** Where each bit starts in the document's own text now. */
  inputStarts: number[] | undefined;
  /** The bit anchors of the output now (see {@link OutputWithBitStarts.anchors}). */
  anchors: Anchor[] | undefined;
}

/** What a change did to a document's views (PLAN-035 D6). */
export interface EngineDocumentUpdate {
  /** One per open view, in the order they were opened; none while the text does not parse. */
  views: readonly EngineViewUpdate[];
  /** Set while the text does not parse (JSON or markup; never bitmark): the views keep their last output. */
  inputError?: { message: string; range: Range };
  /**
   * How long the parser's own call took, in milliseconds (PLAN-044 D2): one
   * call brings every open view up to date. Absent from an engine that does
   * not time it.
   */
  parseMs?: number;
}

/**
 * A text the engine keeps parsed (parser `createDocument`; PLAN-035 D1): the
 * editor's changes go in, and the answers come from what is already parsed,
 * so their cost does not grow with the text.
 */
export interface EngineDocument {
  /**
   * Apply the editor's changes, now at `version` (newer than the last one).
   * Resolves what changed in each open view (PLAN-035 D6).
   */
  applyChanges(
    version: number,
    changes: readonly ContentChange[],
  ): Promise<EngineDocumentUpdate | void>;
  /** Replace the whole text, now at `version`: each open view's whole output. */
  setText(version: number, text: string): Promise<EngineDocumentUpdate | void>;
  /**
   * Keep the text converted to another format as well (the parser's views;
   * PLAN-035 D6): resolves the view's whole output (its only view update),
   * and every later change resolves the edits that bring it up to date.
   * Absent from a document without views.
   */
  openView?(options: EngineViewOptions): Promise<EngineDocumentUpdate>;
  closeView?(view: number): void;
  /** The tokens on `range`'s lines, or of the whole text (absolute layout, UTF-16). */
  semanticTokens(range?: Range): Promise<SemanticTokens>;
  diagnostics(): Promise<Diagnostics>;
  /** Release the document. */
  dispose(): void;
}

/** What the parser can do; fixed per module, independent of the variant. */
export interface EngineCapabilities {
  readonly bitPositions: boolean;
  readonly diagnostics: boolean;
  readonly complete: boolean;
  readonly resolve: boolean;
  readonly hover: boolean;
  readonly info: boolean;
}

/** Options for `complete` and `resolve`. */
export interface CompletionOptions {
  /** The character that opened the list (LSP); omit when invoked explicitly. */
  triggerCharacter?: string;
  /**
   * A bit-type item inserts the bit's template as a snippet
   * (`name]⏎[@id:…]…`) instead of the name alone (parser 7.9+; an older
   * parser ignores it).
   */
  bitTemplate?: boolean;
}

/**
 * The parser, as the editor uses it (PLAN-022 D2, D7, D14).
 *
 * Every call returns a promise, so a worker engine and a main-thread engine
 * share one interface. A call the parser cannot answer resolves `undefined`
 * (an older parser without that export); a parser error rejects with
 * `BitmarkEngineError`.
 */
export interface BitmarkEngine {
  readonly version: string;
  /** The wasm variant in use: `bitmark-json` has no markup formats or descriptions. */
  readonly feature: Feature;
  readonly capabilities: EngineCapabilities;
  /** The markup formats (HTML, XML, text, mapping report) are available. */
  readonly markupFormats: boolean;
  /** Declare the variant now loaded. The host calls this after its own `init` (D7). */
  setFeature(feature: Feature): void;
  /** Called with the new variant whenever it changes. Returns an unsubscribe. */
  onFeatureChange(listener: (feature: Feature) => void): () => void;

  bitmarkToObjects(input: string, options?: ParseOptions): Promise<BitEntry[]>;
  /** bitmark → the JSON text the JSON pane shows, with bit starts (PLAN-018 D1). */
  bitmarkToJsonText(input: string, options?: { mode?: OutputMode }): Promise<JsonText>;
  convert(input: string, options: ConvertOptions): Promise<string>;
  /** `convert`, plus where each bit starts in the output (PLAN-018 D1). */
  convertWithBitStarts(input: string, options: ConvertOptions): Promise<OutputWithBitStarts>;
  semanticTokens(input: string): Promise<SemanticTokens>;
  splitBits(input: string): Promise<BitSlice[] | undefined>;
  diagnostics(input: string): Promise<Diagnostics | undefined>;
  complete(
    input: string,
    position: Position,
    options?: CompletionOptions,
  ): Promise<CompletionList | undefined>;
  /** Pass the same options as the `complete` call that offered `item`. */
  resolve(
    input: string,
    position: Position,
    item: CompletionItem,
    options?: CompletionOptions,
  ): Promise<CompletionItem | undefined>;
  hover(input: string, position: Position): Promise<Hover | null | undefined>;
  info(options: InfoOptions): Promise<string | undefined>;
  /**
   * Open `text` (at the editor's `version`) as a document (PLAN-035 D1).
   * Resolves `undefined` when the parser, or the variant loaded, has no
   * documents (a parser before 7.21; `bitmark-json`): the caller then uses
   * the whole-text calls. Optional, so an engine written before it still fits.
   * `inputFormat`: what the text is (default `bitmark`; PLAN-035 D7).
   * `views`: the document is opened for its views, the output panes'
   * conversions; a worker engine then keeps it beside its conversions, and
   * an editor's own document on the lane that serves typing (PLAN-045 D2).
   */
  openDocument?(
    text: string,
    version: number,
    options?: { inputFormat?: string; views?: boolean },
  ): Promise<EngineDocument | undefined>;
  /** Release what the engine holds (a worker engine terminates its workers). */
  dispose(): void;
}

/** A parser call that failed: the parser's own message. */
export class BitmarkEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BitmarkEngineError';
  }
}
