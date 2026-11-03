import type * as MonacoApi from 'monaco-editor';

import { KnotPair, mapPosition, PositionGeometry } from './mapScrollTop.js';

/** The part of a Monaco editor the group uses. */
export type ScrollSyncEditor = Pick<
  MonacoApi.editor.ICodeEditor,
  | 'getModel'
  | 'getScrollTop'
  | 'setScrollTop'
  | 'getScrollHeight'
  | 'getLayoutInfo'
  | 'getTopForPosition'
  | 'getPosition'
  | 'hasTextFocus'
  | 'onDidScrollChange'
  | 'onDidChangeModelContent'
  | 'onDidContentSizeChange'
  | 'onDidLayoutChange'
  | 'onDidChangeCursorPosition'
>;

/** One pane in a scroll group. */
export interface ScrollSyncMember extends MonacoApi.IDisposable {
  /** The pane's bit starts changed without a content change (markers pinned, a split landed). */
  invalidate(): void;
  /** Take part in the linking (true) or scroll alone (false). Joining follows the leader. */
  setLinked(linked: boolean): void;
  readonly linked: boolean;
}

/**
 * A member's bit anchors (PLAN-028 D4), positions inside its bits that other
 * members know too: for a member showing the bitmark itself, where an
 * anchor's key (its offset in the committed bitmark) is in its own text,
 * which runs ahead of the committed bitmark while an edit converts
 * (PLAN-029 R5); else each anchor's key and its offset in this member's text
 * (UTF-16).
 */
export type MemberAnchors = { readonly bitmark: (key: number) => number } | AnchorList;

/** The anchors of a member not showing the bitmark: keyed by bitmark offset. */
export type AnchorList = readonly {
  key: number;
  offset: number;
  /** A bit's end (its last visible character): bounds a block, never starts one. */
  end?: boolean;
}[];

/** The anchors of a member whose text is the committed bitmark: each key is its own offset. */
export const BITMARK_ANCHORS: MemberAnchors = { bitmark: (key) => key };

/** An anchor both members know: its offset in each, and whether it is a bit's end. */
type AnchorPair = readonly [src: number, dst: number, end?: boolean];

/** A span of a member's text (UTF-16 offsets); `end` undefined: to the end. */
export interface MatchRange {
  start: number;
  end: number | undefined;
}

export interface JoinOptions {
  linked?: boolean;
  /** The member's bit anchors (PLAN-028 D4). */
  anchors?: () => MemberAnchors;
  /**
   * Where the panes are matched, as a fraction of this member's viewport
   * height from its top (PLAN-028 D7); `undefined` while it is not linked to
   * another member.
   */
  onSyncLine?: (fraction: number | undefined) => void;
  /**
   * The block of this member matching the cursor in another member
   * (PLAN-028 D8); `undefined` to clear it.
   */
  onMatch?: (range: MatchRange | undefined) => void;
}

export interface ScrollSyncGroupOptions {
  /**
   * Run `settle` once the current changes are in (PLAN-029 R7): default the
   * next animation frame, else a timeout.
   */
  schedule?: (settle: () => void) => void;
}

const nextFrame = (settle: () => void): void => {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    globalThis.requestAnimationFrame(() => settle());
  } else {
    setTimeout(settle, 0);
  }
};

/** Where the sync line reads while it is not on the cursor: a third of the viewport down. */
export const READING_LINE = 1 / 3;

/**
 * The sync line's fraction of the viewport at scroll `top` (of `max`), off
 * the cursor (PLAN-029 R10): at the reading line, reached from the top edge
 * over the first viewport of scrolling and left for the bottom edge over the
 * last, so both ends of the documents still line up exactly. A document under
 * two viewports long meets the two halfway.
 */
export const readingFraction = (top: number, max: number, height: number): number => {
  if (max <= 0 || top <= 0) return 0;
  if (top >= max) return 1;
  const ramp = Math.min(height, max / 2);
  if (top < ramp) return READING_LINE * (top / ramp);
  if (top > max - ramp) return 1 - (1 - READING_LINE) * ((max - top) / ramp);
  return READING_LINE;
};

export interface ScrollSyncGroup {
  /**
   * Add an editor. `bitStarts` gives its current bit starts (UTF-16
   * offsets); `options.anchors`, its bit anchors, which two members pair by
   * key. A member that joins linked follows the current leader, so a tab
   * switch lands on the matching bit.
   */
  join(
    editor: ScrollSyncEditor,
    bitStarts: () => readonly number[],
    options?: JoinOptions,
  ): ScrollSyncMember;
  /** The current members, in join order. */
  members(): readonly ScrollSyncMember[];
}

interface Pane {
  readonly member: ScrollSyncMember;
  readonly editor: ScrollSyncEditor;
  readonly bitStarts: () => readonly number[];
  readonly options: JoinOptions;
  linked: boolean;
  /** Pixel top of each bit, dropped whenever content or layout changes. */
  tops: number[] | undefined;
  /** Pixel top per offset asked for by the anchors, dropped with `tops`. */
  offsetTops: Map<number, number>;
}

/**
 * Link the scrolling of any number of panes (PLAN-022 D9, generalising
 * PLAN-018 from two slots; PLAN-028):
 * - the member the user scrolls, or moves the cursor in, leads; every other
 *   linked member follows;
 * - the panes are matched on a sync line (D6): by default a third of the
 *   viewport down, the reading line, moving to the viewport's top or bottom
 *   over the first or last viewport of scrolling, so both ends line up
 *   exactly (PLAN-029 R10); while the
 *   leader has focus and its cursor is in view, on the cursor line. A
 *   follower puts the matching position at the same fraction of its own
 *   viewport. Positions map between bit starts and bit anchors;
 * - a cursor move highlights its block, and the matching block in every
 *   other member, linked or not (D8); after a change, the highlights are
 *   matched again from that cursor, even once no member has focus;
 * - the group's own scrolls of followers are not taken as the user's (echo
 *   suppression; Monaco reports `setScrollTop` synchronously);
 * - after a content, marker or layout change the focused member leads, and
 *   the others re-sync, once for every change in the same frame (PLAN-029
 *   R7);
 * - with no leader yet, the first linked member leads.
 */
export const createScrollSyncGroup = (
  groupOptions: ScrollSyncGroupOptions = {},
): ScrollSyncGroup => {
  const schedule = groupOptions.schedule ?? nextFrame;
  const panes: Pane[] = [];
  let leader: Pane | undefined;
  let syncing = false;
  /**
   * The leader's sync line as last used (PLAN-029 R2): on the cursor line or
   * sliding, its fraction, and how far that is from the mode's own fraction
   * (eased away over a viewport of scrolling).
   */
  let line:
    { pane: Pane; cursor: boolean; fraction: number; bias: number; top: number } | undefined;
  /** Members changed since the last settle (PLAN-029 R7). */
  const dirty = new Set<Pane>();
  /**
   * The member whose cursor made the highlights (PLAN-031 D1): matched from
   * again after a change while no member has focus (a tab was clicked).
   */
  let matchSource: Pane | undefined;

  /** The pixel top of `offset` in `pane`'s text. */
  const topAt = (pane: Pane, offset: number): number | undefined => {
    let top = pane.offsetTops.get(offset);
    if (top === undefined) {
      const model = pane.editor.getModel();
      if (!model) return undefined;
      const { lineNumber, column } = model.getPositionAt(offset);
      top = pane.editor.getTopForPosition(lineNumber, column);
      pane.offsetTops.set(offset, top);
    }
    return top;
  };

  const geometry = (pane: Pane): PositionGeometry => {
    if (!pane.tops) {
      pane.tops = pane.editor.getModel()
        ? pane.bitStarts().map((offset) => topAt(pane, offset) ?? 0)
        : [];
    }
    return { bitTops: pane.tops, contentHeight: pane.editor.getScrollHeight() };
  };

  /**
   * The anchors `src` and `dst` share, as offsets in each text (PLAN-028 D4):
   * keyed by bitmark offset, a member showing the bitmark is its own key.
   */
  const anchorPairs = (src: Pane, dst: Pane): AnchorPair[] => {
    const a = src.options.anchors?.();
    const b = dst.options.anchors?.();
    if (!a || !b) return [];
    if ('bitmark' in a) {
      if ('bitmark' in b) return [];
      return b.map((x) => [a.bitmark(x.key), x.offset, x.end]);
    }
    if ('bitmark' in b) return a.map((x) => [x.offset, b.bitmark(x.key), x.end]);
    // Anchors sharing a key (a block and its first list item) pair in order
    // (PLAN-029 R6).
    const inSrc = new Map<number, number[]>();
    for (const { key, offset } of a) {
      const offsets = inSrc.get(key);
      if (offsets) offsets.push(offset);
      else inSrc.set(key, [offset]);
    }
    const used = new Map<number, number>();
    const pairs: AnchorPair[] = [];
    for (const { key, offset, end } of b) {
      const offsets = inSrc.get(key);
      const i = used.get(key) ?? 0;
      if (!offsets || i >= offsets.length) continue;
      used.set(key, i + 1);
      pairs.push([offsets[i]!, offset, end]);
    }
    return pairs;
  };

  /** {@link anchorPairs} as tops in each pane: knots for the mapping. */
  const anchorKnots = (src: Pane, dst: Pane): KnotPair[] => {
    const knots: KnotPair[] = [];
    for (const [s, d] of anchorPairs(src, dst)) {
      const ts = topAt(src, s);
      const td = topAt(dst, d);
      if (ts !== undefined && td !== undefined) knots.push([ts, td]);
    }
    return knots;
  };

  /**
   * The leader's sync line (PLAN-028 D6): its position in the document and
   * its fraction of the viewport — the cursor line while the leader has
   * focus and the cursor is in view, else the reading line (PLAN-029 R10).
   * Between the two it eases over a viewport of scrolling, so the followers
   * do not jump as the cursor leaves the view or comes back (PLAN-029 R2);
   * `snap` (a cursor move), a new leader and either end of the document
   * land on the mode's own line. `cursor`: the cursor's offset, once the
   * line is on it.
   */
  const syncLine = (
    pane: Pane,
    snap: boolean,
  ): { y: number; fraction: number; cursor?: number } => {
    const { editor } = pane;
    const top = editor.getScrollTop();
    const height = editor.getLayoutInfo().height;
    const max = Math.max(0, editor.getScrollHeight() - height);
    let target = readingFraction(top, max, height);
    let cursorAt: number | undefined;
    const cursor = editor.hasTextFocus() ? editor.getPosition() : null;
    const model = editor.getModel();
    if (cursor && model && height > 0) {
      const y = editor.getTopForPosition(cursor.lineNumber, cursor.column);
      if (y >= top && y < top + height) {
        target = (y - top) / height;
        cursorAt = model.getOffsetAt(cursor);
      }
    }
    const onCursor = cursorAt !== undefined;
    let bias = 0;
    if (!snap && line?.pane === pane && height > 0 && top > 0 && top < max) {
      const was = line.cursor === onCursor ? line.bias : line.fraction - target;
      const eased = Math.max(0, Math.abs(was) - Math.abs(top - line.top) / height);
      bias = Math.sign(was) * eased;
    }
    const fraction = Math.min(1, Math.max(0, target + bias));
    line = { pane, cursor: onCursor, fraction, bias, top };
    return {
      y: top + fraction * height,
      fraction,
      ...(onCursor && bias === 0 ? { cursor: cursorAt } : {}),
    };
  };

  /**
   * The block of `dst` matching offset `at` in `src` (PLAN-028 D8): from the
   * last bit start or anchor at or before it, to the next one in `dst`. A
   * bit's end starts no block: just past it, or further along its line (text
   * typed onto the bit, not converted yet: PLAN-031 D2), the bit's last
   * block; on a later line, between bits, none.
   */
  /** Whether offsets `a` and `b` of `pane`'s text are on one line. */
  const sameLine = (pane: Pane, a: number, b: number): boolean => {
    const model = pane.editor.getModel();
    return !!model && model.getPositionAt(a).lineNumber === model.getPositionAt(b).lineNumber;
  };

  const blockFor = (
    src: Pane,
    dst: Pane,
    at: number,
  ):
    | { from: number; to: number | undefined; start: number; end: number | undefined }
    | undefined => {
    const starts = dst.bitStarts();
    const pairs: AnchorPair[] = src
      .bitStarts()
      .slice(0, starts.length)
      .map((s, i) => [s, starts[i]!] as const);
    pairs.push(...anchorPairs(src, dst));
    let best: AnchorPair | undefined;
    let last: AnchorPair | undefined;
    for (const p of pairs) {
      if (p[0] > at) continue;
      if (!last || p[0] >= last[0]) last = p;
      if (!p[2] && (!best || p[0] >= best[0])) best = p;
    }
    if (!best || (last?.[2] && at > last[0] + 1 && !sameLine(src, last[0], at))) {
      return undefined;
    }
    const start = best[1];
    let end: number | undefined;
    let to: number | undefined;
    for (const [s, d] of pairs) {
      if (d > start && (end === undefined || d < end)) end = d;
      if (s > best[0] && (to === undefined || s < to)) to = s;
    }
    return { from: best[0], to, start, end };
  };

  const linked = () => panes.filter((p) => p.linked);
  const currentLeader = (): Pane | undefined => {
    if (leader && leader.linked && panes.includes(leader)) return leader;
    leader = linked()[0];
    return leader;
  };

  /**
   * Show the guide line at `fraction` in every linked member while at least
   * two are linked; clear it everywhere else (PLAN-028 D7, PLAN-029 R1).
   */
  const drawSyncLines = (fraction: number | undefined): void => {
    const shown = fraction !== undefined && linked().length > 1;
    for (const p of panes) p.options.onSyncLine?.(shown && p.linked ? fraction : undefined);
  };

  /**
   * Scroll `targets` (default: every linked follower) to match the leader;
   * `snap`: the sync line lands on its mode's own line (a cursor move).
   */
  const follow = (targets?: Pane[], snap = false): void => {
    const src = currentLeader();
    if (!src) {
      drawSyncLines(undefined);
      return;
    }
    const { y, fraction, cursor } = syncLine(src, snap);
    const srcGeometry = geometry(src);
    syncing = true;
    try {
      for (const dst of targets ?? linked()) {
        if (dst === src || !dst.linked) continue;
        // On the cursor line, the block matching the cursor itself, even
        // where its anchor is out of order (a tag written before the body);
        // elsewhere, the in-order mapping.
        const block = cursor === undefined ? undefined : blockFor(src, dst, cursor);
        const at = block
          ? cursorAt(src, dst, y, block)
          : mapPosition(srcGeometry, geometry(dst), y, anchorKnots(src, dst));
        dst.editor.setScrollTop(at - fraction * dst.editor.getLayoutInfo().height);
      }
    } finally {
      syncing = false;
    }
    drawSyncLines(fraction);
  };

  /**
   * Where the cursor line `y` of `src` falls in `dst`: as far through the
   * matching `block` as the cursor is through its own, so a bitmark line of
   * inline text keeps pace with the much longer JSON it becomes.
   */
  const cursorAt = (
    src: Pane,
    dst: Pane,
    y: number,
    block: { from: number; to: number | undefined; start: number; end: number | undefined },
  ): number => {
    const extent = (pane: Pane, from: number, to: number | undefined): [number, number] => {
      const top = topAt(pane, from) ?? 0;
      const end = to === undefined ? pane.editor.getScrollHeight() : (topAt(pane, to) ?? top);
      return [top, Math.max(top, end)];
    };
    const [srcTop, srcEnd] = extent(src, block.from, block.to);
    const [top, end] = extent(dst, block.start, block.end);
    const through =
      srcEnd > srcTop ? Math.min(1, Math.max(0, (y - srcTop) / (srcEnd - srcTop))) : 0;
    return top + through * (end - top);
  };

  /** Highlight in each follower the block that matches `src`'s cursor (PLAN-028 D8). */
  const match = (src: Pane): void => {
    const model = src.editor.getModel();
    const cursor = src.editor.getPosition();
    if (!model || !cursor) return;
    matchSource = src;
    const at = model.getOffsetAt(cursor);
    // The user's own block too: the narrowest any follower pairs it by.
    let own: MatchRange | undefined;
    // Every member, linked or not: the highlight is not the scrolling.
    for (const dst of panes) {
      if (dst === src) continue;
      const block = blockFor(src, dst, at);
      dst.options.onMatch?.(block && { start: block.start, end: block.end });
      if (!block) continue;
      const end =
        own?.end === undefined
          ? block.to
          : block.to === undefined
            ? own.end
            : Math.min(own.end, block.to);
      own = { start: Math.max(own?.start ?? 0, block.from), end };
    }
    src.options.onMatch?.(own);
  };

  /**
   * Every change since the last settle is in (PLAN-029 R7): the focused
   * member leads, the others follow, and the highlights are matched again,
   * once however many members changed.
   */
  const settle = (): void => {
    const changed = [...dirty].filter((p) => panes.includes(p));
    dirty.clear();
    if (changed.length === 0) return;
    const focused = panes.find((p) => p.editor.hasTextFocus());
    if (changed.some((p) => p.linked)) {
      if (focused?.linked) leader = focused;
      else if (leader && changed.includes(leader)) {
        leader = linked().find((p) => !changed.includes(p)) ?? leader;
      }
      follow();
    }
    // The cursor's block, matched again in the new content (an edit, the
    // regenerated panes after it, a pane shown or joined): the focused
    // member's cursor, else the one that made the highlights (PLAN-031 D1).
    const src = focused ?? (matchSource && panes.includes(matchSource) ? matchSource : undefined);
    if (src) match(src);
    else for (const p of changed) p.options.onMatch?.(undefined);
  };

  /** A member's positions are stale: dropped now, re-synced at the next settle. */
  const refresh = (pane: Pane): void => {
    pane.tops = undefined;
    pane.offsetTops.clear();
    if (dirty.size === 0) schedule(settle);
    dirty.add(pane);
  };

  const join: ScrollSyncGroup['join'] = (editor, bitStarts, options = {}) => {
    const listeners: MonacoApi.IDisposable[] = [];
    const member: ScrollSyncMember = {
      get linked() {
        return pane.linked;
      },
      invalidate: () => refresh(pane),
      setLinked: (next) => {
        if (next === pane.linked) return;
        pane.linked = next;
        if (next) follow([pane]);
        else {
          if (leader === pane) leader = undefined;
          drawSyncLines(line?.fraction);
        }
      },
      dispose: () => {
        for (const l of listeners) l.dispose();
        const i = panes.indexOf(pane);
        if (i === -1) return;
        panes.splice(i, 1);
        dirty.delete(pane);
        if (leader === pane) leader = undefined;
        if (matchSource === pane) matchSource = undefined;
        const fraction = line?.fraction;
        if (line?.pane === pane) line = undefined;
        pane.options.onSyncLine?.(undefined);
        pane.options.onMatch?.(undefined);
        drawSyncLines(fraction);
      },
    };
    const pane: Pane = {
      member,
      editor,
      bitStarts,
      options,
      linked: options.linked ?? true,
      tops: undefined,
      offsetTops: new Map(),
    };
    panes.push(pane);

    listeners.push(
      editor.onDidScrollChange((e) => {
        if (!e.scrollTopChanged || syncing || !pane.linked) return;
        // A scroll that comes with a height change is Monaco clamping after
        // a content change, not the user.
        if (e.scrollHeightChanged) {
          refresh(pane);
          return;
        }
        leader = pane;
        follow();
      }),
      // The user moving the cursor (a click or a key) leads from the cursor
      // line, and shows the matching block in the others (D6, D8).
      editor.onDidChangeCursorPosition(() => {
        if (syncing || !editor.hasTextFocus()) return;
        if (pane.linked) {
          leader = pane;
          follow(undefined, true);
        }
        match(pane);
      }),
      editor.onDidChangeModelContent(() => refresh(pane)),
      editor.onDidContentSizeChange(() => refresh(pane)),
      editor.onDidLayoutChange(() => refresh(pane)),
    );

    if (pane.linked) follow([pane]);
    return member;
  };

  return { join, members: () => panes.map((p) => p.member) };
};
