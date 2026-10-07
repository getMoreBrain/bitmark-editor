// The host's Monaco, loaded on first use (see app.config.ts). Angular's
// builder bundles each `new Worker(new URL(…), { type: 'module' })` as a
// worker. Give each language you include its own worker: the full
// `monaco-editor` import includes HTML, whose requests fail on the generic
// editor worker.
import * as monaco from 'monaco-editor';

self.MonacoEnvironment = {
  getWorker: (_id: string, label: string) => {
    if (label === 'json') return new Worker(new URL('./workers/json.worker', import.meta.url), { type: 'module' });
    if (label === 'html') return new Worker(new URL('./workers/html.worker', import.meta.url), { type: 'module' });
    return new Worker(new URL('./workers/editor.worker', import.meta.url), { type: 'module' });
  },
};

export { monaco };
