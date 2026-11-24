import type { ConvertOptions, Feature } from '@gmb/bitmark-parser';

import { jsonWithBitStarts } from '../json/jsonText.js';
import {
  Anchor,
  BitmarkEngine,
  BitmarkEngineError,
  EngineDocument,
  EngineDocumentUpdate,
  EngineViewUpdate,
  RawParserModule,
} from './types.js';

// The string-based API (`convert`, `info`) reports failures by returning an
// `error: …`-prefixed string rather than throwing.
const PARSER_ERROR_PREFIX = 'error:';

/** `out` unchanged, or a `BitmarkEngineError` thrown when it is a parser error string. */
export const throwIfParserError = (out: string): string => {
  if (out.startsWith(PARSER_ERROR_PREFIX)) {
    throw new BitmarkEngineError(out.slice(PARSER_ERROR_PREFIX.length).trim());
  }
  return out;
};

/**
 * Where a bit span starts in the output: `outputStart` from parser 7.8
 * (PLAN-223, which added `inputStart`), `start` before it.
 */
export const spanOutputStart = (span: { outputStart?: number; start?: number }): number =>
  (span.outputStart ?? span.start)!;

/** The offsets, or `undefined` when the parser gave none (one older than PLAN-223). */
const offsets = (values: readonly unknown[] | undefined): number[] | undefined =>
  values?.every((v) => typeof v === 'number') ? (values as number[]) : undefined;

/**
 * The anchors of a `convertWithDetails` result (parser PLAN-266), or
 * `undefined` from a parser without them. Read structurally, so the core
 * still builds against a parser whose types predate them.
 */
const anchorsOf = (result: object): Anchor[] | undefined => {
  const found = (result as { bitAnchors?: { anchors?: unknown } }).bitAnchors?.anchors;
  if (!Array.isArray(found)) return undefined;
  // Each bit's last anchor is its end (parser PLAN-266 D3).
  const list = found as { index: number; inputOffset: number; outputOffset: number }[];
  return list.map((a, i) => ({
    input: a.inputOffset,
    output: a.outputOffset,
    ...(list[i + 1]?.index !== a.index && { end: true }),
  }));
};

/** Positions in UTF-16, the editors' own units. */
const UTF16 = { positionEncoding: 'utf-16' } as const;

/** Run `fn` as a promise: a synchronous throw becomes a rejection. */
const call = <T>(fn: () => T): Promise<T> => {
  try {
    return Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e instanceof Error ? e : new BitmarkEngineError(String(e)));
  }
};

/** What `fn` answers and how long it took: the parser's own time (PLAN-044 D2). */
const timed = <T>(fn: () => T): [T, number] => {
  const started = performance.now();
  const value = fn();
  return [value, performance.now() - started];
};

/** The parser's own error for a call its loaded variant does not have. */
const isUnsupportedFeature = (e: unknown): boolean =>
  (e as { name?: unknown } | undefined)?.name === 'UnsupportedFeatureError';

/** A view's update as the editor reads it: bit starts and anchors, as a conversion gives them. */
const viewUpdate = (update: {
  view: number;
  output?: string;
  edits: EngineViewUpdate['edits'];
  bitSpans?: { spans: { outputStart?: number; start?: number; inputStart?: number }[] };
}): EngineViewUpdate => ({
  view: update.view,
  ...(update.output !== undefined && { output: update.output }),
  edits: update.edits,
  bitStarts: update.bitSpans?.spans.map(spanOutputStart),
  inputStarts: offsets(update.bitSpans?.spans.map((span) => span.inputStart)),
  anchors: anchorsOf(update),
});

type ParserDocument = ReturnType<NonNullable<RawParserModule['createDocument']>>;

/** The answer to a change, with where the text does not parse while it does not. */
const documentUpdate = (
  doc: ParserDocument,
  [views, parseMs]: [readonly Parameters<typeof viewUpdate>[0][] | undefined, number],
): EngineDocumentUpdate => {
  const inputError = doc.inputError;
  return { views: (views ?? []).map(viewUpdate), ...(inputError && { inputError }), parseMs };
};

/** A parser document behind the engine's async interface (PLAN-035 D1, D6). */
const engineDocument = (doc: ParserDocument): EngineDocument => ({
  applyChanges: (version, changes) =>
    call(() =>
      documentUpdate(
        doc,
        timed(() => doc.applyChanges(version, changes)?.views),
      ),
    ),
  setText: (version, text) =>
    call(() =>
      documentUpdate(
        doc,
        timed(() => doc.setText(version, text)?.views),
      ),
    ),
  // A document without views (none known, but the session then converts whole texts).
  ...(typeof doc.openView === 'function' && {
    openView: (options) =>
      call(() =>
        documentUpdate(
          doc,
          timed(() => [
            doc.openView({
              ...(options as Parameters<typeof doc.openView>[0]),
              bitSpans: true,
              bitAnchors: true,
            }),
          ]),
        ),
      ),
    closeView: (view) => doc.closeView(view),
  }),
  semanticTokens: (range) => call(() => doc.semanticTokens(range, { tokensLayout: 'absolute' })),
  diagnostics: () => call(() => doc.diagnostics()),
  dispose: () => doc.free(),
});

export interface CreateBitmarkEngineOptions {
  /**
   * The variant the host already loaded (PLAN-022 D7). The package never
   * calls `init` on a module it was given: a second `init` swaps the
   * variant, which could silently downgrade the host. Default:
   * `bitmark-json`, so the markup panes stay off until told otherwise.
   */
  feature?: Feature;
}

/**
 * An engine over a parser module that runs on the main thread. The module's
 * synchronous calls are wrapped as promises (PLAN-022 D14).
 */
export const createBitmarkEngine = (
  module: RawParserModule,
  options: CreateBitmarkEngineOptions = {},
): BitmarkEngine => {
  let feature: Feature = options.feature ?? 'bitmark-json';
  const listeners = new Set<(feature: Feature) => void>();

  const engine: BitmarkEngine = {
    version: module.version(),
    get feature() {
      return feature;
    },
    capabilities: {
      bitPositions: !!module.convertWithDetails && !!module.splitBits,
      diagnostics: !!module.diagnostics,
      complete: !!module.complete,
      resolve: !!module.resolve,
      hover: !!module.hover,
      info: !!module.info,
    },
    get markupFormats() {
      return feature !== 'bitmark-json';
    },
    setFeature(next) {
      if (next === feature) return;
      feature = next;
      for (const listener of listeners) listener(next);
    },
    onFeatureChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    bitmarkToObjects: (input, opts) => call(() => module.bitmarkToObjects(input, opts)),
    bitmarkToJsonText: (input, opts) =>
      call(() => {
        const [json, parseMs] = timed(() =>
          jsonWithBitStarts(module.bitmarkToObjects(input, { mode: opts?.mode })),
        );
        return { ...json, parseMs };
      }),
    convert: (input, opts) => call(() => throwIfParserError(module.convert(input, opts))),
    convertWithBitStarts: (input, opts: ConvertOptions) =>
      call(() => {
        // An engine without `convertWithDetails` still converts; it just
        // gives no positions (PLAN-018 D2).
        if (!module.convertWithDetails) {
          const [output, parseMs] = timed(() => module.convert(input, opts));
          return {
            output: throwIfParserError(output),
            bitStarts: undefined,
            inputStarts: undefined,
            anchors: undefined,
            parseMs,
          };
        }
        // `bitAnchors` (PLAN-028 D2): a parser that predates it ignores the
        // flag and returns no anchors.
        const details = { ...opts, bitSpans: true, bitAnchors: true };
        const [result, parseMs] = timed(() => module.convertWithDetails!(input, details));
        const { output, bitSpans } = result;
        return {
          output: throwIfParserError(output),
          bitStarts: bitSpans?.spans.map(spanOutputStart),
          inputStarts: offsets(bitSpans?.spans.map((span) => span.inputStart)),
          anchors: anchorsOf(result),
          parseMs,
        };
      }),
    semanticTokens: (input) =>
      call(() => module.semanticTokens(input, { ...UTF16, tokensLayout: 'absolute' })),
    splitBits: (input) => call(() => module.splitBits?.(input)),
    diagnostics: (input) => call(() => module.diagnostics?.(input, UTF16)),
    complete: (input, position, opts) =>
      call(() => module.complete?.(input, position, { ...UTF16, ...opts })),
    resolve: (input, position, item, opts) =>
      call(() => module.resolve?.(input, position, item, { ...UTF16, ...opts })),
    hover: (input, position) => call(() => module.hover?.(input, position, UTF16)),
    info: (opts) => call(() => (module.info ? throwIfParserError(module.info(opts)) : undefined)),
    openDocument: (text, version, opts) =>
      call(() => {
        if (!module.createDocument) return undefined;
        try {
          const inputFormat = (opts?.inputFormat ?? 'bitmark') as 'bitmark';
          return engineDocument(module.createDocument(text, { inputFormat, version, ...UTF16 }));
        } catch (e) {
          // The variant loaded has no documents (`bitmark-json`).
          if (isUnsupportedFeature(e)) return undefined;
          throw e;
        }
      }),
    dispose: () => listeners.clear(),
  };
  return engine;
};
