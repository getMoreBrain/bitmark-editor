import type { ContentChange } from '@gmb/bitmark-parser';
import type * as MonacoApi from 'monaco-editor';

import type { BitmarkEngine, EngineDocument } from '../engine/types.js';
import { log } from '../log.js';
import type { CodeEditor, IDisposable } from './types.js';

/** An editor's text, kept as a document in the engine (PLAN-035 D2). */
export interface BitmarkDocumentTracker extends IDisposable {
  /**
   * The document, once it holds every change made so far; `undefined` when
   * the engine has none (no engine, a parser or variant without documents).
   */
  current(): Promise<EngineDocument | undefined>;
  /** A document is open or opening. `false`: the engine has none, use the whole text. */
  readonly active: boolean;
  /** The engine changed: open the text in it. */
  refresh(): void;
  /**
   * A call on `doc` failed (a worker lost it, PLAN-045 D4): it is given up,
   * and the whole text is used until the engine changes.
   */
  failed(doc: EngineDocument): void;
}

/** A Monaco change as the parser takes it (0-based lines, UTF-16 characters). */
export const toChange = (c: MonacoApi.editor.IModelContentChange): ContentChange => ({
  range: {
    start: { line: c.range.startLineNumber - 1, character: c.range.startColumn - 1 },
    end: { line: c.range.endLineNumber - 1, character: c.range.endColumn - 1 },
  },
  text: c.text,
});

/**
 * Keep the editor's text open as a document in the engine: each change is
 * handed over as a change, not as the whole text again (PLAN-035 D2). The
 * whole text is sent when the editor replaces it, when a change cannot be
 * told as a range, and when the document and the editor disagree. With an
 * engine that has no documents, `current()` resolves `undefined` and the
 * services use the whole text as before. `onOpen` is called when a document
 * has opened (the engine came, or its variant changed), so they can run again.
 */
export const attachBitmarkDocument = (
  editor: CodeEditor,
  engine: () => BitmarkEngine | undefined,
  onOpen: () => void = () => {},
): BitmarkDocumentTracker => {
  let disposed = false;
  let opened: Promise<EngineDocument | undefined> = Promise.resolve(undefined);
  /** The changes are applied one after the other. */
  let queue: Promise<unknown> = Promise.resolve();
  /** The editor's version the document holds. */
  let synced = 0;
  let active = false;
  /** The engine whose variant changes are listened to. */
  let watched: BitmarkEngine | undefined;
  let offFeature: (() => void) | undefined;

  const close = () => {
    const closing = opened;
    opened = Promise.resolve(undefined);
    active = false;
    void closing.then(
      (doc) => doc?.dispose(),
      () => {},
    );
  };

  const open = () => {
    close();
    const model = editor.getModel();
    const e = disposed ? undefined : engine();
    // A variant with documents may load later (`bitmark-json`, then `full`).
    // Subscribed once per engine: `open` runs from that very notification.
    if (e !== watched) {
      offFeature?.();
      watched = e;
      offFeature = e?.openDocument ? e.onFeatureChange(() => open()) : undefined;
    }
    if (!model || !e?.openDocument) return;
    const version = model.getVersionId();
    const opening = e.openDocument(model.getValue(), version).then(
      (doc) => {
        if (opening !== opened) {
          doc?.dispose();
          return undefined;
        }
        synced = version;
        active = !!doc;
        if (doc) onOpen();
        return doc;
      },
      (err: unknown) => {
        log.error('bitmark document failed to open', err);
        if (opening === opened) active = false;
        return undefined;
      },
    );
    opened = opening;
    queue = opening;
    active = true;
  };

  const onChange = (e: MonacoApi.editor.IModelContentChangedEvent) => {
    const model = editor.getModel();
    if (!model) return;
    // The event's own version: an editor hands on several changes of one
    // operation together, when the model is already at the last one's.
    const version = e.versionId;
    const ranged = !e.isFlush && e.changes.every((c) => c.range);
    // The whole text is taken now: by the time the queue runs it, later
    // changes would be in it too. It is the text of the model's version,
    // which a later change of the same operation must not be applied to.
    const text = ranged ? undefined : model.getValue();
    const textVersion = model.getVersionId();
    const changes = ranged ? e.changes.map(toChange) : [];
    const target = opened;
    queue = queue.then(async () => {
      const doc = await target;
      if (!doc || target !== opened || version <= synced) return;
      try {
        if (text === undefined) {
          await doc.applyChanges(version, changes);
          synced = version;
        } else {
          await doc.setText(textVersion, text);
          synced = textVersion;
        }
      } catch (err) {
        // The document and the editor disagree: send the editor's text.
        const now = editor.getModel();
        if (!now || target !== opened) return;
        try {
          const latest = now.getVersionId();
          await doc.setText(latest, now.getValue());
          synced = latest;
        } catch (again) {
          log.error('bitmark document failed to follow the editor', err, again);
          if (target === opened) close();
        }
      }
    });
  };

  const listeners = [editor.onDidChangeModelContent(onChange), editor.onDidChangeModel(open)];
  open();

  return {
    get active() {
      return active;
    },
    current: () => {
      const target = opened;
      return queue.then(
        () => (target === opened ? target : opened),
        () => undefined,
      );
    },
    refresh: open,
    failed: (doc) => {
      const target = opened;
      void target.then(
        (current) => {
          if (current !== doc || target !== opened) return;
          log.warn('the bitmark document failed; the whole text is used');
          close();
        },
        () => {},
      );
    },
    dispose: () => {
      disposed = true;
      for (const l of listeners) l.dispose();
      offFeature?.();
      offFeature = undefined;
      watched = undefined;
      close();
    },
  };
};
