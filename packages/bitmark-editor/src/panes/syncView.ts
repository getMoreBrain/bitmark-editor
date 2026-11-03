import type * as MonacoApi from 'monaco-editor';

import type { MatchRange } from '../scroll/scrollSyncGroup.js';
import { blockEnd } from './blockEnd.js';
import { injectPaneCss } from './styles.js';

/** The part of a Monaco editor {@link attachSyncView} uses. */
export type SyncViewEditor = Pick<
  MonacoApi.editor.ICodeEditor,
  'getModel' | 'getLayoutInfo' | 'createDecorationsCollection'
>;

export interface SyncViewOptions {
  /** Draw the guide line (PLAN-028 D7). Read on every draw; default on. */
  syncLine?: () => boolean;
  /** Highlight the matching block (D8). Read on every draw; default on. */
  syncMatch?: () => boolean;
}

/** An editor's guide line and block highlight, driven by its scroll group member. */
export interface SyncView extends MonacoApi.IDisposable {
  /** Pass to `join` as `onSyncLine`. */
  onSyncLine(fraction: number | undefined): void;
  /** Pass to `join` as `onMatch`. */
  onMatch(range: MatchRange | undefined): void;
  /** Draw again: after a switch changed, or the editor's layout. */
  refresh(): void;
}

const ON = () => true;

/**
 * Draw what a scroll group tells a member (PLAN-030 D1): the guide line,
 * where the linked panes are matched (PLAN-028 D7), and the block matching
 * the cursor in another member, or in this one (D8). For a host's own
 * editor in a session's group; the session's panes draw through it too.
 * `host` holds the line: a positioned element over the editor, as tall.
 */
export const attachSyncView = (
  editor: SyncViewEditor,
  host: HTMLElement,
  options: SyncViewOptions = {},
): SyncView => {
  const { syncLine = ON, syncMatch = ON } = options;
  injectPaneCss();
  const guide = document.createElement('div');
  guide.className = 'bm-pane-sync-line';
  guide.hidden = true;
  host.appendChild(guide);
  const matched = editor.createDecorationsCollection();
  /** Where the guide line is, when this editor is linked; drawn while `syncLine` is on. */
  let syncFraction: number | undefined;
  /** The block matching the cursor; highlighted while `syncMatch` is on. */
  let lastMatch: MatchRange | undefined;

  const drawGuide = () => {
    guide.hidden = !syncLine() || syncFraction === undefined;
    if (!guide.hidden) {
      guide.style.top = `${Math.round(syncFraction! * editor.getLayoutInfo().height)}px`;
    }
  };

  const drawMatch = () => {
    const range = lastMatch;
    const m = editor.getModel();
    if (!range || !m || !syncMatch()) {
      matched.clear();
      return;
    }
    const from = m.getPositionAt(range.start);
    const end = blockEnd(m, range.start, range.end);
    // A block that starts its line is shown as whole lines; one that starts
    // partway along (an element in a line of markup) as exactly its text.
    if (from.column > m.getLineFirstNonWhitespaceColumn(from.lineNumber)) {
      const to = m.getPositionAt(Math.max(range.start, end));
      matched.set([
        {
          range: {
            startLineNumber: from.lineNumber,
            startColumn: from.column,
            endLineNumber: to.lineNumber,
            endColumn: to.column,
          },
          options: { className: 'bm-sync-match' },
        },
      ]);
      return;
    }
    const first = from.lineNumber;
    const last = Math.max(first, m.getPositionAt(Math.max(range.start, end - 1)).lineNumber);
    matched.set([
      {
        range: { startLineNumber: first, startColumn: 1, endLineNumber: last, endColumn: 1 },
        options: { isWholeLine: true, className: 'bm-sync-match' },
      },
    ]);
  };

  return {
    onSyncLine: (fraction) => {
      syncFraction = fraction;
      drawGuide();
    },
    onMatch: (range) => {
      lastMatch = range;
      drawMatch();
    },
    // A switch only redraws: scrolling and the match itself are untouched.
    refresh: () => {
      drawGuide();
      drawMatch();
    },
    dispose: () => {
      matched.clear();
      guide.remove();
    },
  };
};
