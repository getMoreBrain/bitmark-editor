// The host's Monaco, loaded on first use (see app.config.ts).
//
// Styles: Angular's builder doesn't attach the CSS that Monaco's lazily
// loaded code imports, so Monaco's prebuilt stylesheet is built as
// `monaco.css` (angular.json, `inject: false`) and attached here, before the
// first editor. That keeps it out of the initial bundle.
//
// Workers: Angular's builder bundles each `new Worker(new URL(…), { type:
// 'module' })`. Give each language you include its own worker: the full
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

let styles: Promise<void> | undefined;

/** Monaco, once its stylesheet has loaded. */
export const loadMonaco = async (): Promise<typeof monaco> => {
  styles ??= new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'monaco.css';
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('monaco.css failed to load'));
    document.head.append(link);
  });
  await styles;
  return monaco;
};
