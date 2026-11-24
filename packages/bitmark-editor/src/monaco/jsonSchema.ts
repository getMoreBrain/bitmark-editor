import { DEFAULT_PARSER_VERSION } from '../engine/loadBitmarkEngine.js';
import { log } from '../log.js';
import type { Monaco } from './types.js';

/**
 * Every model the package creates lives under this URI scheme, so the
 * bitmark JSON schema can apply to them alone and never to the host's own
 * JSON editors (PLAN-022 D5).
 */
export const BITMARK_MODEL_SCHEME = 'bitmark-editor';

/**
 * The schema's `fileMatch` for the package's models. Monaco's matcher needs
 * the double-star glob: a single `*` does not cross `/`, so
 * `bitmark-editor://*` silently matches nothing (found in PLAN-023 Phase 0).
 */
export const BITMARK_MODEL_FILE_MATCH = `${BITMARK_MODEL_SCHEME}://**`;

/** What the schema binding needs of Monaco's JSON language service. */
interface JsonDiagnosticsOptions {
  validate?: boolean;
  allowComments?: boolean;
  enableSchemaRequest?: boolean;
  schemas?: { uri: string; fileMatch?: string[]; schema?: unknown }[];
  [other: string]: unknown;
}
interface JsonDefaults {
  /** The options in force (Monaco has it on every version 0.46+). */
  readonly diagnosticsOptions?: JsonDiagnosticsOptions;
  setDiagnosticsOptions(options: JsonDiagnosticsOptions): void;
}

/**
 * Monaco's JSON defaults, wherever this Monaco keeps them: the top-level
 * `monaco.json` (0.55+; `languages.json` is then only a deprecation stub),
 * or `monaco.languages.json` (0.46 to 0.54). `undefined`: no JSON language.
 */
export const jsonDefaultsOf = (monaco: Monaco): JsonDefaults | undefined =>
  (monaco as unknown as { json?: { jsonDefaults?: JsonDefaults } }).json?.jsonDefaults ??
  (monaco.languages as unknown as { json?: { jsonDefaults?: JsonDefaults } }).json?.jsonDefaults;

/** The schema's id in Monaco's JSON service. */
export const BITMARK_SCHEMA_URI = 'https://getmorebrain.github.io/bitmark/bitmark.schema.json';

/**
 * A JSON document of more lines than this is not checked against the schema
 * (PLAN-039 D2). Every use Monaco's JSON service makes of a schema (checking,
 * hover, completion) matches the whole document against it, and the bitmark
 * schema has one alternative per bit type: 15 ms a bit, and on a document of
 * a few thousand bits the service runs out of stack.
 */
export const JSON_SCHEMA_MAX_LINES = 5000;

/** Per Monaco: the bound schema's own `fileMatch`, and the models taken out of it. */
const bindings = new WeakMap<object, { fileMatch: string[]; excluded: Set<string> }>();
const bindingOf = (monaco: Monaco) => {
  let binding = bindings.get(monaco);
  if (!binding) {
    binding = { fileMatch: [BITMARK_MODEL_FILE_MATCH], excluded: new Set() };
    bindings.set(monaco, binding);
  }
  return binding;
};
/** The last pattern that matches decides, and one starting with `!` excludes. */
const fileMatchOf = (binding: { fileMatch: string[]; excluded: Set<string> }): string[] => [
  ...binding.fileMatch,
  ...[...binding.excluded].map((uri) => `!${uri}`),
];

/** The schema URL beside an engine URL (`…/dist/browser/x.js` → `…/schema/…`). */
export const schemaUrlFor = (engineUrl: string): string => {
  const clean = engineUrl.split('?')[0]!;
  if (clean.includes('/dist/browser/')) {
    return `${clean.split('/dist/browser/')[0]}/schema/bitmark.schema.json`;
  }
  // A local-engine route serves the package's own directories.
  return `${clean.replace(/[^/]*$/, '')}schema.json`;
};

/** The schema on jsDelivr for a parser version (an injected module has no URL). */
export const schemaUrlForVersion = (version: string = DEFAULT_PARSER_VERSION): string =>
  `https://cdn.jsdelivr.net/npm/@gmb/bitmark-parser@${version}/schema/bitmark.schema.json`;

/** Fetch the schema; `undefined` on failure (the JSON pane then checks syntax only). */
export const loadBitmarkJsonSchema = async (url: string): Promise<unknown | undefined> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as unknown;
  } catch (e) {
    log.warn('bitmark JSON schema not loaded; the JSON pane checks syntax only', e);
    return undefined;
  }
};

/**
 * Bind `schema` in Monaco's JSON service for the package's models (D5). A
 * host whose every JSON model is bitmark JSON may widen `fileMatch`. Returns false when this Monaco has no JSON language.
 */
export const bindBitmarkJsonSchema = (
  monaco: Monaco,
  schema: unknown,
  options: { fileMatch?: string[] } = {},
): boolean => {
  const jsonDefaults = jsonDefaultsOf(monaco);
  if (!jsonDefaults) return false;
  const binding = bindingOf(monaco);
  binding.fileMatch = options.fileMatch ?? [BITMARK_MODEL_FILE_MATCH];
  // Merge, never replace (D5): the host's own schemas and settings stay; only
  // the bitmark schema's entry is added or replaced.
  const current = jsonDefaults.diagnosticsOptions ?? {};
  jsonDefaults.setDiagnosticsOptions({
    ...current,
    validate: current.validate ?? true,
    schemas: [
      ...(current.schemas ?? []).filter((entry) => entry.uri !== BITMARK_SCHEMA_URI),
      {
        uri: BITMARK_SCHEMA_URI,
        fileMatch: fileMatchOf(binding),
        schema: withoutDraft(schema),
      },
    ],
  });
  return true;
};

/**
 * The schema without its draft (`$schema`), PLAN-039 D1. A JSON service that
 * knows the draft only in part (Monaco up to 0.4x, for 2020-12) answers a
 * schema naming it with one warning on the document's first line and checks
 * nothing. Without the name every version checks with what it knows, and the
 * versions that know 2020-12 take it for a schema that names no draft.
 */
const withoutDraft = (schema: unknown): unknown => {
  if (typeof schema !== 'object' || schema === null || !('$schema' in schema)) return schema;
  const { $schema: _draft, ...rest } = schema as Record<string, unknown>;
  return rest;
};

/**
 * Whether the bound schema applies to the model at `modelUri` (PLAN-039 D2):
 * a pane takes its model out while its document is large. Kept from before
 * the schema is bound.
 */
export const setBitmarkJsonSchemaApplies = (
  monaco: Monaco,
  modelUri: string,
  applies: boolean,
): void => {
  const binding = bindingOf(monaco);
  if (applies === !binding.excluded.has(modelUri)) return;
  if (applies) binding.excluded.delete(modelUri);
  else binding.excluded.add(modelUri);
  const jsonDefaults = jsonDefaultsOf(monaco);
  const current = jsonDefaults?.diagnosticsOptions;
  if (!jsonDefaults || !current?.schemas?.some((entry) => entry.uri === BITMARK_SCHEMA_URI)) return;
  jsonDefaults.setDiagnosticsOptions({
    ...current,
    schemas: current.schemas.map((entry) =>
      entry.uri === BITMARK_SCHEMA_URI ? { ...entry, fileMatch: fileMatchOf(binding) } : entry,
    ),
  });
};
