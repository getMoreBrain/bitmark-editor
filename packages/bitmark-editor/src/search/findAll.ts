import type * as MonacoApi from 'monaco-editor';

/** How a query matches (PLAN-040 D3): Monaco's own find options. */
export interface SearchOptions {
  readonly matchCase: boolean;
  readonly wholeWord: boolean;
  readonly regex: boolean;
}

/** The most matches counted (and highlighted) per pane. */
export const MATCH_CAP = 10_000;

/** Monaco's default `wordSeparators`, which whole-word matching needs. */
export const WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

/** What `findAll` needs from a Monaco model. */
export type SearchModel = Pick<
  MonacoApi.editor.ITextModel,
  'findMatches' | 'findNextMatch' | 'getValue' | 'getValueInRange'
>;

export type FindResult =
  | { readonly ok: true; readonly ranges: readonly MonacoApi.IRange[]; readonly capped: boolean }
  | { readonly ok: false; readonly error: string };

const NO_MATCHES: FindResult = { ok: true, ranges: [], capped: false };

/**
 * The error an invalid regex query gives, or undefined. Compiled as Monaco
 * compiles it (`u` included): a pattern only valid without `u`, such as
 * `\-`, would otherwise find nothing with no error shown.
 */
export const regexError = (query: string, options: SearchOptions): string | undefined => {
  if (!options.regex) return undefined;
  try {
    new RegExp(query, 'gmu');
    return undefined;
  } catch (e) {
    return (e as Error).message;
  }
};

/** Every match of `query` in `model`, up to `cap`; an invalid regex is an error, never a throw. */
export const findAll = (
  model: SearchModel,
  query: string,
  options: SearchOptions,
  cap = MATCH_CAP,
): FindResult => {
  if (!query) return NO_MATCHES;
  const error = regexError(query, options);
  if (error) return { ok: false, error };
  const matches = model.findMatches(
    query,
    false,
    options.regex,
    options.matchCase,
    options.wholeWord ? WORD_SEPARATORS : null,
    false,
    cap + 1,
  );
  const capped = matches.length > cap;
  return {
    ok: true,
    ranges: (capped ? matches.slice(0, cap) : matches).map((m) => m.range),
    capped,
  };
};

/** A match in a plain text: offsets, the end not included. */
export interface TextMatch {
  readonly start: number;
  readonly end: number;
}

export type FindInTextResult =
  | { readonly ok: true; readonly matches: readonly TextMatch[]; readonly capped: boolean }
  | { readonly ok: false; readonly error: string };

/**
 * `text` as a pattern that matches it literally. The syntax characters only:
 * with the `u` flag, an escape of any other character is an error.
 */
export const escapeRegex = (text: string): string => text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

const isSeparator = (char: string | undefined) =>
  char === undefined || /\s/.test(char) || WORD_SEPARATORS.includes(char);

/** Whether a match is a whole word, as Monaco decides it: by the characters around it, or its own first and last. */
const isWholeWord = (text: string, start: number, end: number) =>
  (isSeparator(text[start - 1]) || isSeparator(text[start])) &&
  (isSeparator(text[end]) || isSeparator(text[end - 1]));

/** Whether a regex can match over a line end, as Monaco decides it: it names one, or a class that holds one. */
const isMultiline = (source: string) => /\\[nrW]|\n|\r/.test(source);

/**
 * Every match of `query` in a plain `text`, by the same options, for what is
 * searched without a Monaco model: a tab that is not shown, a host's own
 * view (PLAN-040 D5). As in a Monaco model, a regex that names no line end
 * matches within one line, and an empty match (of `^`, of `x*`) is one too.
 */
export const findInText = (
  text: string,
  query: string,
  options: SearchOptions,
  cap = MATCH_CAP,
): FindInTextResult => {
  if (!query) return { ok: true, matches: [], capped: false };
  const error = regexError(query, options);
  if (error) return { ok: false, error };
  const pattern = new RegExp(
    options.regex ? query : escapeRegex(query),
    options.matchCase ? 'gmu' : 'gimu',
  );
  const matches: TextMatch[] = [];
  /** The matches in `[from, to)`; false once the cap is reached. */
  const find = (from: number, to: number): boolean => {
    const part = from === 0 && to === text.length ? text : text.slice(from, to);
    pattern.lastIndex = 0;
    for (let m = pattern.exec(part); m; m = pattern.exec(part)) {
      const start = from + m.index;
      const end = start + m[0].length;
      // An empty match does not move the search on: by hand, past a whole character.
      if (end === start) pattern.lastIndex += (part.codePointAt(m.index) ?? 0) > 0xffff ? 2 : 1;
      if (options.wholeWord && !isWholeWord(text, start, end)) continue;
      if (matches.length === cap) return false;
      matches.push({ start, end });
    }
    return true;
  };
  if (!options.regex || isMultiline(query)) {
    return { ok: true, matches, capped: !find(0, text.length) };
  }
  for (let from = 0; from <= text.length;) {
    const next = text.indexOf('\n', from);
    const to = next === -1 ? text.length : next;
    if (!find(from, to > from && text[to - 1] === '\r' ? to - 1 : to)) {
      return { ok: true, matches, capped: true };
    }
    from = to + 1;
  }
  return { ok: true, matches, capped: false };
};
