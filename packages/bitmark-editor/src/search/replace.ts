import type * as MonacoApi from 'monaco-editor';

import { regexError, SearchModel, SearchOptions, WORD_SEPARATORS } from './findAll.js';

/** One match and the text that replaces it. */
export interface Replacement {
  readonly range: MonacoApi.IRange;
  readonly text: string;
}

/** The most matches Replace All changes in one go (as Monaco's own). */
const REPLACE_LIMIT = 1_073_741_824;

type CaseOp = 'u' | 'U' | 'l' | 'L';
/** A part of a replace string: a text as it is, or a group of the match (with the case changes before it). */
export type ReplacePiece = string | { group: number; caseOps: ('u' | 'U' | 'l' | 'L')[] };

/**
 * A regex search's replace string, as Monaco's find widget reads it
 * (PLAN-040 D4): `$1`…`$99`, `$0` and `$&` (the match), `$$`, `\n`, `\t`,
 * `\\`, and `\u` `\l` `\U` `\L`, which change the case of the group that
 * follows. Monaco's own parser is not part of its public API, and the core
 * receives Monaco by injection.
 */
export const parseReplaceString = (replace: string): ReplacePiece[] => {
  const pieces: ReplacePiece[] = [];
  let text = '';
  let caseOps: CaseOp[] = [];
  const group = (index: number) => {
    if (text) pieces.push(text);
    text = '';
    pieces.push({ group: index, caseOps });
    caseOps = [];
  };
  for (let i = 0; i < replace.length; i++) {
    const char = replace[i];
    const next = replace[i + 1];
    if (char === '\\' && next !== undefined) {
      if (next === '\\') text += '\\';
      else if (next === 'n') text += '\n';
      else if (next === 't') text += '\t';
      else if ('uUlL'.includes(next)) caseOps.push(next as CaseOp);
      else text += char + next;
      i++;
    } else if (char === '$' && next !== undefined) {
      if (next === '$') {
        text += '$';
        i++;
      } else if (next === '&' || next === '0') {
        group(0);
        i++;
      } else if (next >= '1' && next <= '9') {
        const second = replace[i + 2];
        const two = second !== undefined && second >= '0' && second <= '9';
        group(Number(two ? next + second : next));
        i += two ? 2 : 1;
      } else {
        text += char;
      }
    } else {
      text += char;
    }
  }
  if (text) pieces.push(text);
  return pieces;
};

/** Group `index` of a match; a group the match does not have keeps its digits (`$12` → group 1, then `2`). */
const groupText = (index: number, matches: readonly string[]): string => {
  if (index === 0) return matches[0] ?? '';
  let remainder = '';
  while (index > 0) {
    if (index < matches.length) return (matches[index] ?? '') + remainder;
    remainder = String(index % 10) + remainder;
    index = Math.floor(index / 10);
  }
  return '$' + remainder;
};

const applyCase = (text: string, caseOps: readonly CaseOp[]): string => {
  if (caseOps.length === 0) return text;
  let result = '';
  let op = 0;
  for (let i = 0; i < text.length; i++) {
    if (op >= caseOps.length) return result + text.slice(i);
    const upper = caseOps[op] === 'u' || caseOps[op] === 'U';
    result += upper ? text[i].toUpperCase() : text[i].toLowerCase();
    if (caseOps[op] === 'u' || caseOps[op] === 'l') op++;
  }
  return result;
};

/** The text that replaces a match with these groups. */
export const buildReplaceString = (
  pieces: readonly ReplacePiece[],
  matches: readonly string[] | null,
): string =>
  pieces
    .map((p) =>
      typeof p === 'string' ? p : applyCase(groupText(p.group, matches ?? []), p.caseOps),
    )
    .join('');

/**
 * The match of `query` at `range` in `model` with its replacement, or
 * undefined when there is none exactly there. Only that match is looked at:
 * the cost does not follow the number of matches.
 */
export const replacementAt = (
  model: SearchModel,
  query: string,
  options: SearchOptions,
  replace: string,
  range: MonacoApi.IRange,
): Replacement | undefined => {
  if (!query || regexError(query, options)) return undefined;
  const match = model.findNextMatch(
    query,
    { lineNumber: range.startLineNumber, column: range.startColumn },
    options.regex,
    options.matchCase,
    options.wholeWord ? WORD_SEPARATORS : null,
    options.regex,
  );
  const at = match?.range;
  if (
    !match ||
    !at ||
    at.startLineNumber !== range.startLineNumber ||
    at.startColumn !== range.startColumn ||
    at.endLineNumber !== range.endLineNumber ||
    at.endColumn !== range.endColumn
  ) {
    return undefined;
  }
  const pieces = options.regex ? parseReplaceString(replace) : [replace];
  return { range: at, text: buildReplaceString(pieces, match.matches) };
};

/**
 * Every match of `query` in `model` with its replacement. A regex search's
 * `replace` is a replace pattern (`parseReplaceString`); otherwise it is
 * literal. An invalid regex replaces nothing.
 */
export const replacements = (
  model: SearchModel,
  query: string,
  options: SearchOptions,
  replace: string,
): Replacement[] => {
  if (!query || regexError(query, options)) return [];
  const pieces = options.regex ? parseReplaceString(replace) : [replace];
  return model
    .findMatches(
      query,
      false,
      options.regex,
      options.matchCase,
      options.wholeWord ? WORD_SEPARATORS : null,
      options.regex,
      REPLACE_LIMIT,
    )
    .map((m) => ({ range: m.range, text: buildReplaceString(pieces, m.matches) }));
};
