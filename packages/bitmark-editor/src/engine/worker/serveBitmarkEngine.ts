import type { BitmarkEngine, EngineDocument, Feature } from '../types.js';
import {
  CallRequest,
  DOCUMENT_METHODS,
  DocumentRequest,
  ENGINE_METHODS,
  EnginePort,
  FromWorker,
  OpenDocumentRequest,
  serializeError,
  ToWorker,
} from './protocol.js';

/**
 * Serve an engine over `port`: the worker side. On `init` it loads the
 * engine with `load`, then answers each call in order. A worker runs one
 * call at a time, so the fast lane (tokens, diagnostics) is a second worker
 * (PLAN-022 D14). It keeps the documents opened over the port (PLAN-045):
 * the calls on them are answered one after the other, in the order they
 * came, and a variant that changes gives them all up.
 */
export const serveBitmarkEngine = (
  port: EnginePort,
  load: (url: string, feature: Feature | undefined) => Promise<BitmarkEngine>,
): void => {
  let engine: Promise<BitmarkEngine> | undefined;
  const post = (message: FromWorker) => port.postMessage(message);

  const answer = async (request: CallRequest) => {
    try {
      const e = await engine!;
      if (!ENGINE_METHODS.includes(request.method)) throw new Error(`no method ${request.method}`);
      const fn = e[request.method] as (...args: unknown[]) => Promise<unknown>;
      post({ type: 'result', id: request.id, ok: true, value: await fn(...request.args) });
    } catch (err) {
      post({ type: 'result', id: request.id, ok: false, error: serializeError(err) });
    }
  };

  const documents = new Map<number, EngineDocument>();
  /** What is done with documents, one after the other (PLAN-045 D3). */
  let chain: Promise<void> = Promise.resolve();
  const inOrder = (step: () => Promise<void> | void) => {
    chain = chain.then(step).catch(() => undefined);
  };

  const open = async (request: OpenDocumentRequest) => {
    try {
      const e = await engine!;
      const doc = await e.openDocument?.(request.text, request.version, {
        inputFormat: request.inputFormat,
      });
      if (doc) documents.set(request.doc, doc);
      const value = doc && { views: !!doc.openView };
      post({ type: 'result', id: request.id, ok: true, value });
    } catch (err) {
      post({ type: 'result', id: request.id, ok: false, error: serializeError(err) });
    }
  };
  const onDocument = async (request: DocumentRequest) => {
    try {
      const doc = documents.get(request.doc);
      if (!doc) throw new Error('the document is not open in the worker (any more)');
      const fn = DOCUMENT_METHODS.includes(request.method)
        ? (doc[request.method] as ((...args: unknown[]) => unknown) | undefined)
        : undefined;
      if (!fn) throw new Error(`no document method ${request.method}`);
      post({ type: 'result', id: request.id, ok: true, value: await fn(...request.args) });
    } catch (err) {
      post({ type: 'result', id: request.id, ok: false, error: serializeError(err) });
    }
  };
  const release = (id: number) => {
    documents.get(id)?.dispose();
    documents.delete(id);
  };

  port.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as ToWorker;
    if (message.type === 'init') {
      if (engine) return;
      engine = load(message.url, message.feature);
      engine.then(
        (e) => {
          post({
            type: 'ready',
            version: e.version,
            feature: e.feature,
            capabilities: e.capabilities,
          });
          e.onFeatureChange((feature) => {
            // Another variant is another parser: its documents are not this
            // one's (D4). Told after what is still to be answered, so that
            // the other side knows exactly which documents went.
            inOrder(() => {
              [...documents.keys()].forEach(release);
              post({ type: 'feature', feature });
            });
          });
        },
        (err) => post({ type: 'failed', error: serializeError(err) }),
      );
    } else if (message.type === 'call') {
      void answer(message);
    } else if (message.type === 'open') {
      inOrder(() => open(message));
    } else if (message.type === 'document') {
      inOrder(() => onDocument(message));
    } else if (message.type === 'release') {
      inOrder(() => release(message.doc));
    }
  });
};
