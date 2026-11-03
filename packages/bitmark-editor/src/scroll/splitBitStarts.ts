import type * as MonacoApi from 'monaco-editor';

import { createLatestRunner, SUPERSEDED } from '../engine/latest.js';
import type { BitmarkEngine } from '../engine/types.js';
import { log } from '../log.js';

/** The bit starts of a pane that shows bitmark, kept current as it changes. */
export interface SplitBitStarts extends MonacoApi.IDisposable {
  /** The latest known starts (UTF-16 offsets); `[]` until the first split lands. */
  bitStarts(): readonly number[];
  /** Split again now (e.g. the engine changed). */
  refresh(): void;
}

const warnedNoStart = new WeakSet<BitmarkEngine>();

type ContentChange = Pick<
  MonacoApi.editor.IModelContentChange,
  'rangeOffset' | 'rangeLength' | 'text'
>;

/**
 * Where `offset` is after `changes` (one Monaco event: each range is in the
 * text before them all). Past a change, it moves with the text; inside a
 * replaced range, it stays where it was, within what replaced it.
 */
export const shiftOffset = (offset: number, changes: readonly ContentChange[]): number => {
  let delta = 0;
  let inside: ContentChange | undefined;
  for (const c of changes) {
    if (c.rangeOffset + c.rangeLength <= offset) delta += c.text.length - c.rangeLength;
    else if (c.rangeOffset < offset) inside = c;
  }
  return inside
    ? inside.rangeOffset + delta + Math.min(offset - inside.rangeOffset, inside.text.length)
    : offset + delta;
};

/**
 * Where each bit starts in a bitmark pane's text: the parser's `splitBits`
 * `start` (PLAN-018 D1), split asynchronously once per content version
 * (PLAN-022 D14). `onChange` is called when new starts land, so the scroll
 * group can re-measure. Bitmark that is broken still splits, at each `[.`.
 * Until a change's split lands, the starts move with the text it changed
 * (PLAN-032 D1): typing never leaves them pointing at the text before it.
 */
export const createSplitBitStarts = (
  editor: Pick<
    MonacoApi.editor.ICodeEditor,
    'getModel' | 'onDidChangeModelContent' | 'onDidChangeModel'
  >,
  engine: () => BitmarkEngine | undefined,
  onChange: () => void,
): SplitBitStarts => {
  let starts: readonly number[] = [];
  let disposed = false;
  const latest = createLatestRunner((e: BitmarkEngine, text: string) => e.splitBits(text));

  const set = (next: readonly number[]) => {
    starts = next;
    onChange();
  };

  const refresh = () => {
    const model = editor.getModel();
    const e = engine();
    if (!model || !e) {
      if (starts.length) set([]);
      return;
    }
    const version = model.getVersionId();
    latest(e, model.getValue()).then(
      (slices) => {
        if (disposed || slices === SUPERSEDED) return;
        if (editor.getModel() !== model || model.getVersionId() !== version) return;
        // An engine older than parser PLAN-221 has no `start` (PLAN-018 D2).
        const next = (slices ?? [])
          .map((slice) => slice.start)
          .filter((start): start is number => typeof start === 'number');
        if (slices && slices.length > 0 && next.length === 0 && !warnedNoStart.has(e)) {
          warnedNoStart.add(e);
          log.warn(
            'splitBits gives no `start` (parser older than PLAN-221): scroll linking is proportional',
          );
        }
        set(next);
      },
      (err) => {
        if (disposed) return;
        log.error('splitBits failed', err);
        set([]);
      },
    );
  };

  const listeners = [
    editor.onDidChangeModelContent((e) => {
      if (e.changes?.length) starts = starts.map((start) => shiftOffset(start, e.changes));
      refresh();
    }),
    editor.onDidChangeModel(refresh),
  ];
  refresh();

  return {
    bitStarts: () => starts,
    refresh,
    dispose: () => {
      disposed = true;
      for (const l of listeners) l.dispose();
    },
  };
};
