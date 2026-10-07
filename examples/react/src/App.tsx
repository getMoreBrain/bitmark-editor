import { BitmarkPane, BitmarkSession } from '@gmb/bitmark-editor/react';
import { useState } from 'react';

import { monaco } from './monaco';

const INITIAL = '[.article]\nHello **World**!\n\n[.cloze]\nThe capital of France is [_Paris].';

export const App = () => {
  // The document as the app holds it. Passing it back as `value` is safe:
  // the session recognises its own edits and doesn't reset the editor.
  const [bitmark, setBitmark] = useState(INITIAL);
  const [status, setStatus] = useState('none yet');

  return (
    <>
      <h1>bitmark editor: React</h1>
      {/* The parser loads from jsDelivr at the package's pinned version. */}
      <BitmarkSession
        monaco={monaco}
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
