import type * as MonacoApi from 'monaco-editor';

import type { EditChanges } from '../editor/textEditor.js';
import {
  type BitmarkEngine,
  BitmarkEngineError,
  type EngineDocument,
  type EngineDocumentUpdate,
  type EngineViewOptions,
  type EngineViewUpdate,
} from '../engine/types.js';
import { log } from '../log.js';
import { toChange } from '../monaco/documentTracker.js';
import type { TextModel } from '../monaco/types.js';
import { nextLineStart } from '../scroll/textChange.js';

/** What a pane's own text converts to, as its document reports it. */
export interface SourceDocumentSink {
  /**
   * The text converted: the bitmark, where each bit starts in the text, and
   * the changes that made the bitmark from the last one reported, where the
   * view answered with edits (PLAN-043 D3).
   */
  converted(
    bitmark: string,
    inputStarts: readonly number[] | undefined,
    changes: EditChanges | undefined,
  ): void;
  /** The text does not parse. */
  failed(error: Error): void;
  /** No documents (any more): convert the whole text instead. */
  lost(): void;
}

/** A pane's own text, kept as a document that converts it to bitmark (PLAN-035 D7). */
export interface SourceDocument {
  /**
   * A change the user made. False when the engine has no documents: the
   * caller converts the whole text, as before.
   */
  edit(event: MonacoApi.editor.IModelContentChangedEvent): boolean;
  /** The text was replaced from outside (a regeneration): the document goes, and the next edit opens one. */
  drop(): void;
  /** Whether the last edit went through the document. */
  readonly active: boolean;
  /**
   * The view's options changed (PLAN-046 D3): the view is opened again on
   * the document as it is, whose text is not read again. Nothing is
   * reported: the next edit answers with the bitmark written the new way.
   */
  reopenView(): void;
  dispose(): void;
}

/** `text` with `edits` applied: ranges in `text`, in order and not overlapping. */
export const applyViewEdits = (text: string, edits: EngineViewUpdate['edits']): string => {
  let result = '';
  let taken = 0;
  // The edits are in order: the lines are counted on from one to the next.
  let line = 0;
  let lineStart = 0;
  const offsetOf = (position: { line: number; character: number }): number => {
    while (line < position.line) {
      const next = nextLineStart(text, lineStart);
      if (next === -1) break;
      lineStart = next;
      line++;
    }
    return Math.min(text.length, lineStart + position.character);
  };
  for (const edit of edits) {
    const start = offsetOf(edit.range.start);
    const end = offsetOf(edit.range.end);
    result += text.slice(taken, start) + edit.newText;
    taken = end;
  }
  return result + text.slice(taken);
};

/** Engines found without documents for a format, per variant (a later variant may have them). */
const without = new WeakMap<BitmarkEngine, Set<string>>();

/**
 * Keep an editable output pane's own text as a document of the engine, with
 * a bitmark view (PLAN-035 D7): what the user types goes in as a change, and
 * the bitmark comes back as the edits to the last one, so an edit's cost
 * follows the edit, not the text. The document is opened by the first edit
 * and dropped when the pane's text is replaced from outside, so a pane that
 * is only read costs nothing here.
 */
export const attachSourceDocument = (
  model: TextModel,
  engine: () => BitmarkEngine | undefined,
  spec: { inputFormat: string; view: () => EngineViewOptions },
  sink: SourceDocumentSink,
): SourceDocument => {
  let state:
    { doc: EngineDocument; bitmark: string; view: number | undefined; synced: number } | undefined;
  let queue: Promise<void> = Promise.resolve();
  /** +1 per document dropped: what is still queued for it is skipped. */
  let generation = 0;
  let active = false;
  let disposed = false;

  const drop = () => {
    generation++;
    state?.doc.dispose();
    state = undefined;
    active = false;
  };
  const key = (e: BitmarkEngine) => `${e.feature}:${spec.inputFormat}`;

  /** The document, opened on the text as it is now; `undefined`: no documents. */
  const open = async (e: BitmarkEngine, gen: number) => {
    const version = model.getVersionId();
    const doc = await e.openDocument!(model.getValue(), version, {
      inputFormat: spec.inputFormat,
      views: true,
    });
    if (!doc?.openView) {
      doc?.dispose();
      return undefined;
    }
    const opened = await doc.openView(spec.view());
    if (disposed || gen !== generation) {
      doc.dispose();
      return undefined;
    }
    const view = opened.views[0];
    state = { doc, bitmark: view?.output ?? '', view: view?.view, synced: version };
    return opened;
  };

  const report = (update: EngineDocumentUpdate | void) => {
    if (!state) return;
    if (update?.inputError) {
      // As the whole conversion reports it (PLAN-042 D4). The JSON language
      // marks its own syntax errors: named as one, JSON gets no second marker.
      sink.failed(
        spec.inputFormat === 'json'
          ? Object.assign(new Error(update.inputError.message), { name: 'SyntaxError' })
          : new BitmarkEngineError(update.inputError.message),
      );
      return;
    }
    const view = update?.views[0];
    const base = state.bitmark;
    if (view) state.bitmark = view.output ?? applyViewEdits(base, view.edits);
    // The view's edits are places in the last bitmark, in order: from the
    // last to the first, each applies to the text the one before left.
    const changes =
      view && view.output === undefined
        ? {
            base,
            changes: view.edits
              .map((edit) => ({ range: edit.range, text: edit.newText }))
              .reverse(),
          }
        : undefined;
    sink.converted(state.bitmark, view?.inputStarts, changes);
  };

  return {
    get active() {
      return active;
    },
    edit: (event) => {
      const e = engine();
      if (disposed || !e?.openDocument || without.get(e)?.has(key(e))) {
        active = false;
        return false;
      }
      active = true;
      // The event's own version: several changes of one operation arrive
      // together, when the model is already at the last one's.
      const version = event.versionId;
      const changes =
        !event.isFlush && event.changes.every((c) => c.range)
          ? event.changes.map(toChange)
          : undefined;
      const gen = generation;
      queue = queue.then(async () => {
        if (disposed || gen !== generation) return;
        try {
          if (!state) {
            // Opened on the text as it is now, by its latest change: that text holds the earlier ones.
            if (version < model.getVersionId()) return;
            const opened = await open(e, gen);
            if (disposed || gen !== generation) return;
            if (!opened) {
              const known = without.get(e) ?? new Set<string>();
              known.add(key(e));
              without.set(e, known);
              drop();
              sink.lost();
              return;
            }
            report(opened);
            return;
          }
          if (version <= state.synced) return;
          const update = changes
            ? await state.doc.applyChanges(version, changes)
            : await state.doc.setText(version, model.getValue());
          if (disposed || gen !== generation) return;
          state.synced = changes ? version : model.getVersionId();
          report(update);
        } catch (err) {
          if (disposed || gen !== generation) return;
          log.warn('the document of a pane failed; its whole text is converted', err);
          drop();
          sink.lost();
        }
      });
      return true;
    },
    drop,
    reopenView: () => {
      const gen = generation;
      queue = queue.then(async () => {
        // No document (yet): the next one is opened with the options as they are then.
        if (disposed || gen !== generation || !state) return;
        const { doc } = state;
        try {
          if (state.view !== undefined) doc.closeView?.(state.view);
          const opened = await doc.openView!(spec.view());
          if (disposed || gen !== generation) return;
          const view = opened.views[0];
          state.view = view?.view;
          state.bitmark = view?.output ?? '';
        } catch (err) {
          if (disposed || gen !== generation) return;
          log.warn('the view of a pane’s document could not be opened again', err);
          // The next edit opens a document again, or converts the whole text.
          drop();
        }
      });
    },
    dispose: () => {
      disposed = true;
      drop();
    },
  };
};
