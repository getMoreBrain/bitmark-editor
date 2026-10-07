import { createBitmarkPane, createBitmarkSession, createHtmlPane, createJsonPane } from '@gmb/bitmark-editor';

import { monaco } from './monaco';

// One document; the parser loads from jsDelivr at the package's pinned version.
const INITIAL = '[.article]\nHello **World**!\n\n[.cloze]\nThe capital of France is [_Paris].';
const session = createBitmarkSession({ monaco, value: INITIAL });

createBitmarkPane(document.getElementById('bitmark')!, session);
createJsonPane(document.getElementById('json')!, session);
createHtmlPane(document.getElementById('html')!, session, { readOnly: true });

const status = document.getElementById('status')!;
session.on('change', ({ bitmark, source }) => {
  status.textContent = `${bitmark.length} characters of bitmark, from the ${source?.type ?? 'app'} pane`;
});
// Setting the document from the app: every pane regenerates, keeping its undo.
document.getElementById('reset')!.addEventListener('click', () => session.setBitmark(INITIAL));
session.on('error', ({ error }) => {
  status.textContent = `Error: ${error.message}`;
});
