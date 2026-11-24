export type {
  FindInTextResult,
  FindResult,
  SearchModel,
  SearchOptions,
  TextMatch,
} from './findAll.js';
export {
  escapeRegex,
  findAll,
  findInText,
  MATCH_CAP,
  regexError,
  WORD_SEPARATORS,
} from './findAll.js';
export { findInElement } from './findInElement.js';
export type { Replacement, ReplacePiece } from './replace.js';
export { buildReplaceString, parseReplaceString, replacementAt, replacements } from './replace.js';
export type { HiddenSource, SearchController, SearchControllerDeps } from './searchController.js';
export {
  ACTIVATION_TIMEOUT_MS,
  createSearchController,
  SEARCH_CURRENT_CLASS,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MATCH_CLASS,
} from './searchController.js';
export type { SearchShortcutOptions } from './searchShortcut.js';
export {
  attachSearchShortcut,
  searchOptionShortcut,
  searchShortcut,
  searchStepShortcut,
} from './searchShortcut.js';
export type {
  PaneResult,
  SearchField,
  SearchSettings,
  SearchSnapshot,
  SearchState,
} from './searchState.js';
export { activePaneId, countText, createSearchState, tabResultId } from './searchState.js';
export type { SearchEditor, SearchTarget, SearchTargets } from './searchTargets.js';
export { createSearchTargets } from './searchTargets.js';
