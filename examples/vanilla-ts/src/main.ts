import {
  type BitmarkTheme,
  createBitmarkPane,
  createBitmarkSession,
  createHtmlPane,
  createJsonPane,
} from '@gmb/bitmark-editor';

import { monaco } from './monaco';

// One document; the parser loads from jsDelivr at the package's pinned version.
const INITIAL = '[.article]\nHello **World**!\n\n[.cloze]\nThe capital of France is [_Paris].';
// The token colours and Monaco's own theme must match. This app owns its
// Monaco, so it lets the session set Monaco's (page-wide) theme as well.
const session = createBitmarkSession({ monaco, value: INITIAL, theme: 'auto', applyMonacoTheme: true });

createBitmarkPane(document.getElementById('bitmark')!, session);
createJsonPane(document.getElementById('json')!, session);
createHtmlPane(document.getElementById('html')!, session, { readOnly: true });

const status = document.getElementById('status')!;
session.on('change', ({ bitmark, source }) => {
  status.textContent = `${bitmark.length} characters of bitmark, from the ${source?.type ?? 'app'} pane`;
});
// Setting the document from the app: every pane regenerates, keeping its undo.
document.getElementById('reset')!.addEventListener('click', () => session.setBitmark(INITIAL));
const themeSelect = document.getElementById('theme') as HTMLSelectElement;
themeSelect.addEventListener('change', () => {
  const theme = themeSelect.value as Extract<BitmarkTheme, string>;
  session.setTheme(theme);
  // The page follows too: `auto` lets the browser pick from the OS setting.
  document.documentElement.style.colorScheme = theme === 'auto' ? 'light dark' : theme;
});
session.on('error', ({ error }) => {
  status.textContent = `Error: ${error.message}`;
});
