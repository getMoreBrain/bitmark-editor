export type { AttachBitmarkEditorOptions, BitmarkEditorServices } from './attach.js';
export { attachBitmarkEditor } from './attach.js';
export type { BitmarkSuggestion, CompletionQuery } from './completion.js';
export {
  COMPLETE_OPTIONS,
  COMPLETION_TRIGGER_CHARACTERS,
  monacoKind,
  replacedPrefixLength,
  replacedSuffixLength,
  toMonacoSuggestion,
  triggerCharacterOf,
} from './completion.js';
export {
  attachBitmarkDiagnostics,
  BITMARK_MARKER_OWNER,
  buildBitmarkMarkers,
  DIAGNOSTICS_DEBOUNCE_MS,
  markerSeverity,
} from './diagnostics.js';
export {
  attachBitmarkHighlighter,
  buildBitmarkDecorations,
  HIGHLIGHT_DEBOUNCE_MS,
} from './highlighter.js';
export {
  bindBitmarkJsonSchema,
  BITMARK_MODEL_FILE_MATCH,
  BITMARK_MODEL_SCHEME,
  BITMARK_SCHEMA_URI,
  loadBitmarkJsonSchema,
  schemaUrlFor,
  schemaUrlForVersion,
} from './jsonSchema.js';
export type { SetupBitmarkMonacoOptions } from './setup.js';
export {
  bindModelEngine,
  BITMARK_LANGUAGE_CONFIGURATION,
  BITMARK_LANGUAGE_ID,
  engineForModel,
  setupBitmarkMonaco,
  toMonacoHover,
} from './setup.js';
export type { CodeEditor, IDisposable, Monaco, TextModel } from './types.js';
