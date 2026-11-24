import type { Anchor } from '../engine/types.js';

/** A line's start up to an anchor: only tags (and spaces), e.g. the empty item in `[%][%lead]`. */
const TAGS_ONLY = /^[ \t]*(?:\[[^\]\n]*\][ \t]*)+$/;

/**
 * Anchors with their bitmark key moved back over tags that made no value
 * (PLAN-029 R9): when only such tags come before an anchor on its line —
 * no other anchor starts among them — they belong to its block, so a block
 * before it does not claim the line, and the cursor on them finds this
 * block. `[%][%lead]`: the empty item makes no value and no anchor, so the
 * lead's key moves to the `[%]`. A bit's end is never moved.
 */
export const snapAnchorKeys = (bitmark: string, anchors: readonly Anchor[]): Anchor[] => {
  // The keys in order, so "is there an anchor in this stretch" is one search,
  // not a walk over all of them (a book has thousands, many after a tag).
  const keys = Float64Array.from(anchors, (a) => a.input).sort();
  /** Whether an anchor starts in `[from, to)`. */
  const startsIn = (from: number, to: number): boolean => {
    let low = 0;
    let high = keys.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (keys[middle]! < from) low = middle + 1;
      else high = middle;
    }
    return low < keys.length && keys[low]! < to;
  };
  return anchors.map((a) => {
    // At its line's start (most are), or after something that is no tag: nothing to move over.
    if (a.end || a.input === 0 || bitmark.charCodeAt(a.input - 1) === 10) return a;
    const before = bitmark.charCodeAt(a.input - 1);
    if (before !== 93 && before !== 32 && before !== 9) return a;
    const lineStart = bitmark.lastIndexOf('\n', a.input - 1) + 1;
    const prefix = bitmark.slice(lineStart, a.input);
    if (!TAGS_ONLY.test(prefix)) return a;
    const first = lineStart + prefix.indexOf('[');
    if (startsIn(first, a.input)) return a;
    return { ...a, input: first };
  });
};
