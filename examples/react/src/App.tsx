import type { BitmarkTheme } from '@gmb/bitmark-editor';
import { BitmarkPane, BitmarkSession } from '@gmb/bitmark-editor/react';
import { useEffect, useState } from 'react';

import { monaco } from './monaco';

const INITIAL = '[.article]\nHello **World**!\n\n[.cloze]\nThe capital of France is [_Paris].';

export const App = () => {
  // The document as the app holds it. Passing it back as `value` is safe:
  // the session recognises its own edits and doesn't reset the editor.
  const [bitmark, setBitmark] = useState(INITIAL);
  const [status, setStatus] = useState('none yet');
  const [theme, setTheme] = useState<Extract<BitmarkTheme, string>>('auto');

  // The page follows the theme too: `auto` lets the browser pick from the OS setting.
  useEffect(() => {
    document.documentElement.style.colorScheme = theme === 'auto' ? 'light dark' : theme;
  }, [theme]);

  return (
    <>
      <header>
        <h1>bitmark editor: React</h1>
        <label>
          Theme{' '}
          <select value={theme} onChange={(e) => setTheme(e.target.value as typeof theme)}>
            <option value="auto">Auto</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </header>
      {/* The parser loads from jsDelivr at the package's pinned version. The
          token colours and Monaco's own theme must match: this app owns its
          Monaco, so the session sets Monaco's (page-wide) theme as well. */}
      <BitmarkSession
        monaco={monaco}
        theme={theme}
        applyMonacoTheme
        value={bitmark}
        onChange={({ bitmark, source }) => {
          setBitmark(bitmark);
          setStatus(`${bitmark.length} characters of bitmark, from the ${source?.type ?? 'app'} pane`);
        }}
        onError={({ error }) => setStatus(`Error: ${error.message}`)}
      >
        <div className="panes">
          <BitmarkPane type="bitmark" />
          <BitmarkPane type="json" />
          <BitmarkPane type="html" readOnly />
        </div>
      </BitmarkSession>
      <p>
        Last change: <output id="status">{status}</output>
      </p>
      <button type="button" onClick={() => setBitmark(INITIAL)}>
        Reset
      </button>
    </>
  );
};
