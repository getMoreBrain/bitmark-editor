import type { SearchOptions } from './findAll.js';

/** One pane's matches, for a search bar. */
export interface PaneResult {
  /** The area of a pane on screen, or a hidden source's id. */
  readonly id: string;
  readonly label: string;
  readonly count: number;
  /** More matches than were counted (`MATCH_CAP`). */
  readonly capped: boolean;
  /** The current match (0-based), or -1 before the first step. */
  readonly current: number;
  /** A tab that is not shown: counted, not highlighted. */
  readonly hidden: boolean;
  /** A pane that cannot be edited: nothing to replace. */
  readonly readOnly: boolean;
}

/** A search bar's two inputs. */
export type SearchField = 'search' | 'replace';

/** The search as a bar shows it: a new object for each change. */
export interface SearchSnapshot {
  /** Searching: highlights and counts are shown. */
  readonly open: boolean;
  readonly query: string;
  /** The replace input's text. */
  readonly replace: string;
  /** The replace row is shown. */
  readonly showReplace: boolean;
  readonly options: SearchOptions;
  /** The tabs that are not shown are counted too. */
  readonly includeHidden: boolean;
  /** An invalid regex's message. */
  readonly error: string | undefined;
  /** The pane Next/Previous step through. */
  readonly activeId: string | undefined;
  readonly results: readonly PaneResult[];
  /** Bumped to ask the search bar to focus `focusField`. */
  readonly focusRequests: number;
  readonly focusField: SearchField;
}

export interface SearchState extends SearchSnapshot {
  /** The state now: the same object until something changes (React's `useSyncExternalStore`, a signal). */
  snapshot(): SearchSnapshot;
  /** Calls back with the key that changed; returns the unsubscribe. */
  subscribe(listener: (key: keyof SearchSnapshot) => void): () => void;
  setOpen(open: boolean): void;
  setQuery(query: string): void;
  setReplace(replace: string): void;
  setShowReplace(show: boolean): void;
  toggleOption(option: keyof SearchOptions): void;
  setIncludeHidden(value: boolean): void;
  setError(error: string | undefined): void;
  setActiveId(id: string | undefined): void;
  setResults(results: readonly PaneResult[]): void;
  requestFocus(field?: SearchField): void;
}

/** What a host may keep between visits: the options, never the query. */
export interface SearchSettings extends SearchOptions {
  readonly includeHidden: boolean;
}

/**
 * The pane Next/Previous and Replace act on, as the controller picks it: the
 * chosen pane while on screen, else the first.
 */
export const activePaneId = (
  results: readonly PaneResult[],
  activeId: string | undefined,
): string | undefined => {
  const live = results.filter((r) => !r.hidden);
  return live.find((r) => r.id === activeId)?.id ?? live[0]?.id;
};

/** The result id of a tab: its area while shown, else its hidden-source id. */
export const tabResultId = (area: string, tab: string, shown: boolean): string =>
  shown ? area : `hidden:${area}:${tab}`;

/** A pane's count for a bar: "7", "2/7", "10000+". */
export const countText = (r: PaneResult): string => {
  const count = `${r.count}${r.capped ? '+' : ''}`;
  return r.current === -1 ? count : `${r.current + 1}/${count}`;
};

/** The search's state (PLAN-040 D6): plain values, setters, and a subscription. */
export const createSearchState = (settings: Partial<SearchSettings> = {}): SearchState => {
  let snap: SearchSnapshot = {
    open: false,
    query: '',
    replace: '',
    showReplace: false,
    options: {
      matchCase: !!settings.matchCase,
      wholeWord: !!settings.wholeWord,
      regex: !!settings.regex,
    },
    includeHidden: !!settings.includeHidden,
    error: undefined,
    activeId: undefined,
    results: [],
    focusRequests: 0,
    focusField: 'search',
  };
  const listeners = new Set<(key: keyof SearchSnapshot) => void>();
  const set = <K extends keyof SearchSnapshot>(key: K, value: SearchSnapshot[K]) => {
    if (snap[key] === value) return;
    snap = { ...snap, [key]: value };
    [...listeners].forEach((l) => l(key));
  };

  return {
    get open() {
      return snap.open;
    },
    get query() {
      return snap.query;
    },
    get replace() {
      return snap.replace;
    },
    get showReplace() {
      return snap.showReplace;
    },
    get options() {
      return snap.options;
    },
    get includeHidden() {
      return snap.includeHidden;
    },
    get error() {
      return snap.error;
    },
    get activeId() {
      return snap.activeId;
    },
    get results() {
      return snap.results;
    },
    get focusRequests() {
      return snap.focusRequests;
    },
    get focusField() {
      return snap.focusField;
    },
    snapshot: () => snap,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setOpen: (open) => set('open', open),
    setQuery: (query) => set('query', query),
    setReplace: (replace) => set('replace', replace),
    setShowReplace: (show) => set('showReplace', show),
    toggleOption: (option) => set('options', { ...snap.options, [option]: !snap.options[option] }),
    setIncludeHidden: (value) => set('includeHidden', value),
    setError: (error) => set('error', error),
    setActiveId: (id) => set('activeId', id),
    // Nothing found before and nothing now is no change.
    setResults: (results) => {
      if (results.length > 0 || snap.results.length > 0) set('results', results);
    },
    requestFocus(field = 'search') {
      set('focusField', field);
      set('focusRequests', snap.focusRequests + 1);
    },
  };
};
