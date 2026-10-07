// The host's Monaco, with its workers set up the usual Vite way. Give each
// language you include its own worker: the full `monaco-editor` import
// includes HTML, whose requests fail on the generic editor worker.
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';

self.MonacoEnvironment = {
  getWorker: (_id: string, label: string) => {
    if (label === 'json') return new jsonWorker();
    if (label === 'html') return new htmlWorker();
    return new editorWorker();
  },
};

export { monaco };
