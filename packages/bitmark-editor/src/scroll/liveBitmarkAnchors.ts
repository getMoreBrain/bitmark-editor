import type { MemberAnchors } from './scrollSyncGroup.js';
import { offsetMap } from './textChange.js';

/**
 * The anchors of a member showing the bitmark (PLAN-029 R5): a key, an
 * offset into the committed bitmark, moved onto the member's own text, which
 * runs ahead of it while an edit waits out the debounce and converts. The
 * move is made again only when either text changes; equal texts keep keys.
 */
export const liveBitmarkAnchors = (
  version: () => number,
  text: () => string,
  committed: () => string,
): MemberAnchors => {
  let live = { version: -1, committed: '', move: (key: number) => key };
  return {
    bitmark: (key) => {
      const v = version();
      const c = committed();
      if (v !== live.version || c !== live.committed) {
        const t = text();
        live = { version: v, committed: c, move: t === c ? (k) => k : offsetMap(c, t) };
      }
      return live.move(key);
    },
  };
};
