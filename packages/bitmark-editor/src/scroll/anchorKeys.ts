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
  const keys = new Set(anchors.map((a) => a.input));
  return anchors.map((a) => {
    if (a.end) return a;
    const lineStart = bitmark.lastIndexOf('\n', a.input - 1) + 1;
    const prefix = bitmark.slice(lineStart, a.input);
    if (!TAGS_ONLY.test(prefix)) return a;
    const first = lineStart + prefix.indexOf('[');
    for (const key of keys) if (key >= first && key < a.input) return a;
    return { ...a, input: first };
  });
};
