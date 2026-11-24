import { parserCdnUrl } from '../loadBitmarkEngine.js';
import {
  BitmarkEngine,
  BitmarkEngineError,
  EngineCapabilities,
  EngineDocument,
  Feature,
} from '../types.js';
import {
  CallRequest,
  DocumentMethod,
  DocumentRequest,
  EngineMethod,
  EnginePort,
  FromWorker,
  OpenDocumentRequest,
  ReleaseDocumentRequest,
  ResultMessage,
} from './protocol.js';

/**
 * Methods on the fast lane: what the editor needs on every keystroke and
 * must never wait behind a long conversion (PLAN-022 D14).
 */
const FAST_LANE: ReadonlySet<EngineMethod> = new Set([
  'semanticTokens',
  'splitBits',
  'diagnostics',
  'complete',
  'resolve',
  'hover',
]);

export interface CreateBitmarkWorkerEngineOptions {
  /** Start one worker running the engine worker script (`engineWorker`). Called twice: one per lane. */
  createPort: () => EnginePort;
  /** The parser's browser build, loaded inside each worker. Default: jsDelivr at the pinned version. */
  url?: string;
  version?: string;
  /** Stage 2 variant inside the workers. Default `full`. */
  feature?: Feature;
}

/** A message that is answered: the lane gives it its `id`. */
type Request =
  Omit<CallRequest, 'id'> | Omit<OpenDocumentRequest, 'id'> | Omit<DocumentRequest, 'id'>;

interface Lane {
  port: EnginePort;
  feature: Feature;
  /** Reject `ready` and every pending call; later calls reject at once. */
  fail(error: Error): void;
  /** Send `request` and resolve its answer. */
  request(request: Request): Promise<unknown>;
  /** Send a message that is not answered. */
  post(message: ReleaseDocumentRequest): void;
  /**
   * The documents the lane's worker keeps (PLAN-045): each is told here
   * when the worker lost it.
   */
  documents: Set<() => void>;
  ready: Promise<{ version: string; feature: Feature; capabilities: EngineCapabilities }>;
}

const openLane = (
  port: EnginePort,
  url: string,
  feature: Feature | undefined,
  onFeature: () => void,
): Lane => {
  let nextId = 0;
  const pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void }>();
  let resolveReady!: Lane['ready'] extends Promise<infer T> ? (v: T) => void : never;
  let rejectReady!: (e: Error) => void;
  const ready = new Promise<{
    version: string;
    feature: Feature;
    capabilities: EngineCapabilities;
  }>((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
  });
  let dead: Error | undefined;
  let isReady = false;
  const lane: Lane = {
    port,
    feature: 'bitmark-json',
    ready,
    fail(error) {
      if (dead) return;
      dead = error;
      rejectReady(error);
      for (const p of pending.values()) p.reject(error);
      pending.clear();
    },
    request(request) {
      if (dead) return Promise.reject(dead);
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        port.postMessage({ ...request, id });
      });
    },
    post(message) {
      if (!dead) port.postMessage(message);
    },
    documents: new Set(),
  };
  /** The worker no longer has the documents it kept, or cannot be trusted to (PLAN-045 D4). */
  const loseDocuments = () => {
    for (const lost of [...lane.documents]) lost();
  };
  port.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as FromWorker;
    if (message.type === 'ready') {
      isReady = true;
      lane.feature = message.feature;
      resolveReady(message);
    } else if (message.type === 'feature') {
      lane.feature = message.feature;
      // Another variant is another parser: the worker gave its documents up.
      loseDocuments();
      onFeature();
    } else if (message.type === 'failed') {
      rejectReady(new BitmarkEngineError(message.error.message));
    } else if (message.type === 'result') {
      const r = message as ResultMessage;
      const p = pending.get(r.id);
      if (!p) return;
      pending.delete(r.id);
      if (r.ok) p.resolve(r.value);
      else {
        const err = new BitmarkEngineError(r.error?.message ?? 'worker call failed');
        err.name = r.error?.name ?? err.name;
        p.reject(err);
      }
    }
  });
  // A worker script that 404s, a CSP block, or a crash (out of memory on a
  // huge document): fail the lane, so nothing waits for ever.
  const onError = (event: Event) => {
    const message =
      (event as ErrorEvent).message || `the bitmark engine worker failed (${event.type})`;
    const error = new BitmarkEngineError(message);
    // Before `ready`: the worker never started, so the lane is dead. After:
    // the calls in flight may be lost, so they reject, but the worker may
    // well be alive, so later calls still go to it.
    if (!isReady) lane.fail(error);
    else {
      for (const p of pending.values()) p.reject(error);
      pending.clear();
      // What became of a document whose call was lost is not known.
      loseDocuments();
    }
  };
  port.addEventListener('error', onError as (e: MessageEvent) => void);
  port.addEventListener('messageerror', onError as (e: MessageEvent) => void);
  port.postMessage({ type: 'init', url, feature });
  return lane;
};

/**
 * An engine whose parser runs in workers, off the main thread (PLAN-022
 * D14): one worker for the fast lane (tokens, diagnostics, completion,
 * hover, bit splits) and one for conversions. Resolves once both workers
 * have loaded the parser (stage 1); `feature` follows stage 2 once both
 * lanes have it. The workers keep the documents (PLAN-045), so the
 * incremental work is theirs too.
 *
 * Calls are not coalesced here: one engine can serve several documents, so
 * "the latest call" is the caller's to decide (`createLatestRunner`).
 */
export const createBitmarkWorkerEngine = async (
  options: CreateBitmarkWorkerEngineOptions,
): Promise<BitmarkEngine> => {
  const url = options.url ?? parserCdnUrl(options.version);
  const listeners = new Set<(feature: Feature) => void>();
  let feature: Feature = 'bitmark-json';
  const lanes: Lane[] = [];
  const onFeature = () => {
    // The engine's variant is the one both lanes have reached.
    if (lanes.length < 2 || lanes[0]!.feature !== lanes[1]!.feature) return;
    setFeature(lanes[0]!.feature);
  };
  const setFeature = (next: Feature) => {
    if (next === feature) return;
    feature = next;
    for (const listener of listeners) listener(next);
  };
  const fast = openLane(options.createPort(), url, options.feature, onFeature);
  const slow = openLane(options.createPort(), url, options.feature, onFeature);
  lanes.push(fast, slow);

  const end = () => {
    for (const lane of lanes) {
      lane.fail(new BitmarkEngineError('the bitmark engine was disposed'));
      lane.port.terminate?.();
      lane.port.close?.();
    }
  };
  let first;
  try {
    [first] = await Promise.all([fast.ready, slow.ready]);
  } catch (e) {
    end();
    throw e;
  }
  onFeature();

  const call =
    <R>(method: EngineMethod) =>
    (...args: unknown[]): Promise<R> =>
      (FAST_LANE.has(method) ? fast : slow).request({ type: 'call', method, args }) as Promise<R>;

  /**
   * A document kept in a worker (PLAN-045): an editor's own on the fast
   * lane, where its colours and diagnostics never wait behind a conversion;
   * one opened for its views on the other, beside the conversions it
   * replaces (D2). Its calls reach the worker in the order they are made.
   */
  let documents = 0;
  const openDocument: BitmarkEngine['openDocument'] = async (text, version, opts) => {
    const lane = opts?.views ? slow : fast;
    const doc = ++documents;
    let opened: { views: boolean } | undefined;
    try {
      opened = (await lane.request({
        type: 'open',
        doc,
        text,
        version,
        inputFormat: opts?.inputFormat,
      })) as typeof opened;
    } catch (e) {
      // The answer was lost, not the request: the worker may hold the document.
      lane.post({ type: 'release', doc });
      throw e;
    }
    // The worker's parser, or its variant, has no documents.
    if (!opened) return undefined;
    let gone: string | undefined;
    const releaseDocument = (why: string) => {
      if (gone) return;
      gone = why;
      lane.documents.delete(lost);
      lane.post({ type: 'release', doc });
    };
    const lost = () => releaseDocument('the worker lost the document');
    lane.documents.add(lost);
    const on = <R>(method: DocumentMethod, ...args: unknown[]): Promise<R> =>
      gone
        ? Promise.reject(new BitmarkEngineError(gone))
        : (lane.request({ type: 'document', doc, method, args }) as Promise<R>);
    const proxy: EngineDocument = {
      applyChanges: (v, changes) => on('applyChanges', v, changes),
      setText: (v, next) => on('setText', v, next),
      ...(opened.views && {
        openView: (options) => on('openView', options),
        closeView: (view) => void on('closeView', view).catch(() => undefined),
      }),
      semanticTokens: (range) => on('semanticTokens', range),
      diagnostics: () => on('diagnostics'),
      dispose: () => releaseDocument('the document was released'),
    };
    return proxy;
  };

  return {
    version: first.version,
    get feature() {
      return feature;
    },
    capabilities: first.capabilities,
    get markupFormats() {
      return feature !== 'bitmark-json';
    },
    // The workers own their parser's variant; a host-declared one only labels it.
    setFeature,
    onFeatureChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    bitmarkToObjects: call('bitmarkToObjects'),
    bitmarkToJsonText: call('bitmarkToJsonText'),
    convert: call('convert'),
    convertWithBitStarts: call('convertWithBitStarts'),
    semanticTokens: call('semanticTokens'),
    splitBits: call('splitBits'),
    diagnostics: call('diagnostics'),
    complete: call('complete'),
    resolve: call('resolve'),
    hover: call('hover'),
    info: call('info'),
    openDocument,
    dispose: () => {
      listeners.clear();
      end();
    },
  };
};
