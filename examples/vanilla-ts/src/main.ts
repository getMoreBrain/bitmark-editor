import { createBitmarkPane, createBitmarkSession, createHtmlPane, createJsonPane } from '@gmb/bitmark-editor';

import { monaco } from './monaco';

// One document; the parser loads from jsDelivr at the package's pinned version.
const session = createBitmarkSession({
  monaco,
  value: '[.article]\nHello **World**!\n\n[.cloze]\nThe capital of France is [_Paris].',
});

createBitmarkPane(document.getElementById('bitmark')!, session);
createJsonPane(document.getElementById('json')!, session);
createHtmlPane(document.getElementById('html')!, session, { readOnly: true });

const status = document.getElementById('status')!;
session.on('change', ({ bitmark, source }) => {
  status.textContent = `${bitmark.length} characters of bitmark, from the ${source?.type ?? 'app'} pane`;
});
session.on('error', ({ error }) => {
  status.textContent = `Error: ${error.message}`;
});
