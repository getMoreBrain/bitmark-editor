import type { ContentChange } from '@gmb/bitmark-parser';

import { withParseMs } from '../engine/parseTime.js';
import type {
  BitmarkEngine,
  EngineDocument,
  EngineDocumentUpdate,
  EngineViewOptions,
  EngineViewUpdate,
} from '../engine/types.js';
import { log } from '../log.js';
import { nextLineStart, splitsPair, textChange } from '../scroll/textChange.js';

/** A view's change, for the session version it brings the view to. */
export interface SessionViewUpdate extends EngineViewUpdate {
  /** The session version this is the output of. */
  version: number;
  /** The session version the edits start from; `undefined` with the whole output. */
  base: number | undefined;
  /** The bitmark of `version`. */
  bitmark: string;
  /** An API change: shown even where the user has focus. */
  force: boolean;
  /**
   * How long the parser took for the change, in milliseconds (PLAN-044 D4):
   * one call brings every view up to date, so every view of a change has
   * the same time.
   */
  parseMs: number;
}

export interface SessionViewListener {
  update(update: SessionViewUpdate): void;
  /** The view is not served (no documents, or the document failed): convert the whole text instead. */
  lost(): void;
}

/** A pane's hold on its view. */
export interface SessionView {
  /** The view's updates are coming or will come: the pane does not convert by itself. */
  readonly expected: boolean;
  /** The pane no longer shows the view's output: send the whole output again. */
  resync(): void;
  dispose(): void;
}

export interface SessionDocument {
  /** The engine arrived, or its variant changed: open `bitmark` (at session `version`) again. */
  open(engine: BitmarkEngine | undefined, bitmark: string, version: number): void;
  /**
   * The session's text went from `before` to `after`, now at `version`.
   * `changes`: what turns the one into the other, where the edit told them
   * (PLAN-043 D4); without them the change is found by comparing the two.
   */
  commit(
    before: string,
    after: string,
    version: number,
    force: boolean,
    changes?: readonly ContentChange[],
  ): void;
  openView(options: EngineViewOptions, listener: SessionViewListener): SessionView;
  dispose(): void;
}

/**
 * `offset` in `text` as an LSP position, counted on from `from`: the start
 * of a line at or before it, and that line's number.
 */
const positionAt = (text: string, offset: number, from = { line: 0, lineStart: 0 }) => {
  let { line, lineStart } = from;
  for (let next = nextLineStart(text, lineStart); next !== -1 && next <= offset;) {
    line++;
    lineStart = next;
    next = nextLineStart(text, next);
  }
  return { line, character: offset - lineStart, lineStart };
};

/** The one stretch that turns `before` into `after`, as the parser takes it. */
export const changeBetween = (before: string, after: string): ContentChange => {
  let { start, oldEnd, newEnd } = textChange(before, after);
  // Never split a surrogate pair or a CRLF: widen the stretch over it.
  if (start > 0 && splitsPair(before.charCodeAt(start - 1))) start--;
  if (oldEnd > start && oldEnd < before.length && splitsPair(before.charCodeAt(oldEnd - 1))) {
    oldEnd++;
    newEnd++;
  }
  const from = positionAt(before, start);
  const to = positionAt(before, oldEnd, from);
  return {
    range: {
      start: { line: from.line, character: from.character },
      end: { line: to.line, character: to.character },
    },
    text: after.slice(start, newEnd),
  };
};

/**
 * The session's text, kept converted (PLAN-035 D6): one parser document,
 * with a view for each output pane that asks for one. A commit goes in as
 * the changes its edit made (PLAN-043), or as the one stretch that differs,
 * and each view answers with the edits that bring its pane up to date, so a pane's cost follows the change, not the
 * text. Everything runs in the order it was asked, on one queue.
 */
export const createSessionDocument = (): SessionDocument => {
  interface View {
    options: EngineViewOptions;
    listener: SessionViewListener;
    id: number | undefined;
    lost: boolean;
  }
  const views = new Set<View>();
  let engine: BitmarkEngine | undefined;
  /** The session's text now, whether or not a document holds it. */
  let latest = { version: 0, text: '' };
  let doc: EngineDocument | undefined;
  let opening = false;
  /** +1 per document: what an earlier one still answers is dropped. */
  let generation = 0;
  /** The parser's own version of the document: only ever grows. */
  let docVersion = 0;
  /** What the document holds: the session's version and text. */
  let held = { version: 0, text: '' };
  let disposed = false;
  let queue: Promise<void> = Promise.resolve();

  const close = () => {
    generation++;
    doc?.dispose();
    doc = undefined;
    opening = false;
    for (const view of views) view.id = undefined;
  };
  const lose = () => {
    close();
    for (const view of views) {
      if (view.lost) continue;
      view.lost = true;
      view.listener.lost();
    }
  };
  const enqueue = (op: () => Promise<void>) => {
    const gen = generation;
    queue = queue.then(async () => {
      if (disposed || gen !== generation) return;
      try {
        await op();
      } catch (e) {
        if (disposed || gen !== generation) return;
        log.warn('the document of the session failed; its panes convert the whole text', e);
        lose();
      }
    });
  };

  const deliver = (
    { value: updates, parseMs }: { value: EngineDocumentUpdate | void; parseMs: number },
    base: number | undefined,
    force: boolean,
  ) => {
    for (const update of updates?.views ?? []) {
      const view = [...views].find((v) => v.id === update.view);
      view?.listener.update({
        ...update,
        version: held.version,
        base: update.output === undefined ? base : undefined,
        bitmark: held.text,
        force,
        parseMs,
      });
    }
  };
  const showView = async (d: EngineDocument, view: View) => {
    let opened: { value: EngineDocumentUpdate; parseMs: number };
    try {
      opened = await withParseMs(() => d.openView!(view.options));
    } catch (e) {
      if (disposed || d !== doc || !views.has(view)) return;
      // Is it the view the parser refuses, or the document that is gone? A
      // document that still takes a change (none, here) is not gone; one
      // that does not fails here, and is given up with all its views.
      await d.applyChanges(++docVersion, []);
      if (disposed || d !== doc || !views.has(view)) return;
      // This view alone is lost (PLAN-042 D3): a format the parser does not
      // write. The document and its other views go on.
      log.warn(
        `no view of the session's document as ${view.options.outputFormat}; its pane converts the whole text`,
        e,
      );
      view.lost = true;
      view.listener.lost();
      if ([...views].every((v) => v.lost)) close();
      return;
    }
    const update = opened.value.views[0];
    if (!update) return;
    if (d !== doc || !views.has(view)) {
      d.closeView?.(update.view);
      return;
    }
    view.id = update.view;
    deliver(opened, undefined, false);
  };
  /** A document only while a pane has a view of it: without one, a change costs nothing here. */
  const ensure = () => {
    const e = engine;
    if (doc || opening || !e?.openDocument || ![...views].some((v) => !v.lost)) return;
    opening = true;
    const { text, version } = latest;
    enqueue(async () => {
      const gen = generation;
      const opened = await e.openDocument!(text, ++docVersion, { views: true });
      // Given up while it opened (the last view went, another engine came).
      if (disposed || gen !== generation) {
        opened?.dispose();
        return;
      }
      if (!opened?.openView) {
        // No documents (an older parser, the `bitmark-json` variant), or none with views.
        opened?.dispose();
        lose();
        return;
      }
      doc = opened;
      opening = false;
      held = { version, text };
      // A view lost stays lost until another engine or variant comes (`open`).
      for (const view of [...views]) {
        if (opened !== doc) return;
        if (!view.lost) await showView(opened, view);
      }
    });
  };

  return {
    open: (next, bitmark, version) => {
      close();
      engine = next;
      latest = { version, text: bitmark };
      if (!next?.openDocument) {
        lose();
        return;
      }
      for (const view of views) view.lost = false;
      ensure();
    },
    commit: (before, after, version, force, changes) => {
      latest = { version, text: after };
      if (!doc && !opening) return;
      enqueue(async () => {
        const d = doc;
        if (!d) return;
        // A text the document does not hold: the whole text.
        const base = before === held.text ? held.version : undefined;
        const updates = await withParseMs(() =>
          base === undefined
            ? d.setText(++docVersion, after)
            : d.applyChanges(++docVersion, changes ?? [changeBetween(before, after)]),
        );
        if (d !== doc) return;
        held = { version, text: after };
        deliver(updates, base, force);
      });
    },
    openView: (options, listener) => {
      const view: View = { options, listener, id: undefined, lost: !engine?.openDocument };
      views.add(view);
      const show = () =>
        enqueue(async () => {
          if (!doc || !views.has(view)) return;
          if (view.id !== undefined) doc.closeView?.(view.id);
          view.id = undefined;
          await showView(doc, view);
        });
      if (doc) show();
      else ensure();
      return {
        get expected() {
          return !view.lost && (opening || doc !== undefined);
        },
        resync: show,
        dispose: () => {
          views.delete(view);
          if (doc && view.id !== undefined) doc.closeView?.(view.id);
          if (views.size === 0) close();
        },
      };
    },
    dispose: () => {
      disposed = true;
      close();
      views.clear();
    },
  };
};
