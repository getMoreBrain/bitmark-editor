/** One pane's scroll geometry: where each bit's top is, and how far it scrolls. */
export interface ScrollGeometry {
  /** Pixel top of each bit, in bit order. */
  readonly bitTops: readonly number[];
  /** The largest scroll top the pane accepts (0 when it cannot scroll). */
  readonly maxScrollTop: number;
}

/**
 * The knots of the mapping: `[0, bit tops…, maxScrollTop]`, using only the
 * first `pairs` bits, clamped to `[0, maxScrollTop]` and made non-decreasing,
 * so bits past the end of a short document collapse onto the end of the
 * scroll range instead of breaking the mapping.
 */
export const buildKnots = (geometry: ScrollGeometry, pairs: number): number[] => {
  const max = Math.max(0, geometry.maxScrollTop);
  const knots = [0];
  for (let i = 0; i < pairs; i++) {
    const top = Math.min(max, Math.max(0, geometry.bitTops[i] ?? 0));
    knots.push(Math.max(top, knots[knots.length - 1]!));
  }
  knots.push(max);
  return knots;
};

/**
 * Map a scroll top from one pane to the other, bit by bit: part-way through
 * bit *i* on one side is the same fraction of the way through bit *i* on the
 * other. Bits pair by position, up to the shorter list; with no bits on one
 * side the mapping is proportional.
 */
export const mapScrollTop = (
  src: ScrollGeometry,
  dst: ScrollGeometry,
  scrollTop: number,
): number => {
  const pairs = Math.min(src.bitTops.length, dst.bitTops.length);
  const s = buildKnots(src, pairs);
  const d = buildKnots(dst, pairs);
  const last = s.length - 1;
  if (scrollTop <= 0) return 0;
  if (scrollTop >= s[last]!) return d[last]!;

  // The last knot at or before `scrollTop`; the next one is past it, as the
  // knots never decrease and `scrollTop` is inside the range.
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid]! <= scrollTop) lo = mid;
    else hi = mid;
  }
  const t = (scrollTop - s[lo]!) / (s[lo + 1]! - s[lo]!);
  return d[lo]! + t * (d[lo + 1]! - d[lo]!);
};

/** A position known in both panes: its top in the source and in the destination. */
export type KnotPair = readonly [src: number, dst: number];

/** One pane's document, for {@link mapPosition}. */
export interface PositionGeometry {
  /** Pixel top of each bit, in bit order. */
  readonly bitTops: readonly number[];
  /** The height of the whole document (the end of the last line). */
  readonly contentHeight: number;
}

/**
 * Map a position in the source document (a pixel `y` from its top) to the
 * destination's (PLAN-028 D4, D6). The knots are the two ends (0, and each
 * content height), the bit tops paired by bit, and `anchors` — positions
 * known in both panes (parser bit anchors). They are ordered by the source
 * and kept to the longest run that is in order in the destination too, so
 * an anchor the configuration placed out of order (a tag written before
 * the body) never folds the mapping back; between knots the mapping is
 * linear.
 */
export const mapPosition = (
  src: PositionGeometry,
  dst: PositionGeometry,
  y: number,
  anchors: readonly KnotPair[] = [],
): number => {
  const srcEnd = Math.max(0, src.contentHeight);
  const dstEnd = Math.max(0, dst.contentHeight);
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));
  const pairs = Math.min(src.bitTops.length, dst.bitTops.length);
  // Inside the documents, every knot is clamped; the ends are always kept.
  const inner: KnotPair[] = [];
  for (let i = 0; i < pairs; i++) {
    inner.push([clamp(src.bitTops[i]!, srcEnd), clamp(dst.bitTops[i]!, dstEnd)]);
  }
  for (const [s, d] of anchors) inner.push([clamp(s, srcEnd), clamp(d, dstEnd)]);
  inner.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const kept: KnotPair[] = [[0, 0], ...inOrder(inner), [srcEnd, dstEnd]];
  if (y <= 0) return 0;
  if (y >= srcEnd) return dstEnd;
  let lo = 0;
  let hi = kept.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (kept[mid]![0] <= y) lo = mid;
    else hi = mid;
  }
  const [s0, d0] = kept[lo]!;
  const [s1, d1] = kept[hi]!;
  return s1 === s0 ? d0 : d0 + ((y - s0) / (s1 - s0)) * (d1 - d0);
};

/**
 * The longest subsequence of `knots` (ordered by source) whose destinations
 * never decrease.
 */
const inOrder = (knots: readonly KnotPair[]): KnotPair[] => {
  if (knots.length === 0) return [];
  // Patience sorting: `tails[k]` ends the best run of length k + 1.
  const tails: number[] = [];
  const before: number[] = new Array(knots.length).fill(-1);
  for (let i = 0; i < knots.length; i++) {
    const d = knots[i]![1];
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (knots[tails[mid]!]![1] <= d) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) before[i] = tails[lo - 1]!;
    tails[lo] = i;
  }
  const out: KnotPair[] = [];
  for (let i = tails[tails.length - 1]!; i !== -1; i = before[i]!) out.push(knots[i]!);
  return out.reverse();
};
