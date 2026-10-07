# @gmb/bitmark-editor

A bitmark editor built on [Monaco](https://microsoft.github.io/monaco-editor/),
with syntax highlighting, error checking, autocomplete and hover help, for
any framework. Alongside it, scroll-linked editors show the bitmark converted
to JSON, HTML, XML and Text. It uses its own built-in Monaco and bitmark
parser, or the ones your app already has, injected.

<!-- docs-site-links: links into the docs site, hidden in comments until it is deployed (only the API reference is). To show them, remove the comment.
**Documentation, guides and live demos: https://getmorebrain.github.io/bitmark-editor/**
-->

> Pre-release: 0.1.0, not yet published.

## Install

```sh
npm install @gmb/bitmark-editor monaco-editor
```

`monaco-editor` is only needed when you inject your own Monaco. For Angular,
see [`@gmb/bitmark-editor-angular`](https://www.npmjs.com/package/@gmb/bitmark-editor-angular).

<!-- docs-site-links
[Which build?](https://getmorebrain.github.io/bitmark-editor/getting-started/)
-->

## How it works

- A **session** holds one bitmark document.
- **Panes** are Monaco editors on a session: bitmark, JSON, HTML, XML, Text,
  Info and Mappings. Editing the bitmark, JSON, HTML or XML pane updates the
  others. A pane fills the element it is mounted in, so give that element a
  height.
- The **parser**, [`@gmb/bitmark-parser`](https://www.npmjs.com/package/@gmb/bitmark-parser),
  does the language work: highlighting, errors, autocomplete, hover and the
  conversions.

Monaco and the parser can each be built-in or injected:

- **Monaco.** Apps with a bundler usually inject their own Monaco, set up
  with its workers as usual. Static pages use the built-in one, from
  `/bundled` (Monaco 0.57, its workers set up for you). An injected Monaco
  keeps its own, page-wide theme: set the session's `theme` to match it, or
  set `applyMonacoTheme` and the session sets Monaco's theme for you.
- **The parser.** By default the editor loads it from jsDelivr, at a version
  pinned in this package. To inject your own, see
  [Injecting your own parser](#injecting-your-own-parser).

## Entry points

| Entry | What it is |
|---|---|
| `@gmb/bitmark-editor` | The core: sessions, panes, the parser engine, themes, scroll linking. No Monaco inside. |
| `@gmb/bitmark-editor/react` | React components: `<BitmarkSession>`, `<BitmarkPane>`. |
| `@gmb/bitmark-editor/elements` | Custom elements (`<bitmark-session>`, `<bitmark-pane>`), defined on import. No Monaco inside. |
| `@gmb/bitmark-editor/bundled` | The custom elements with the built-in Monaco. CDN-ready. |
| `@gmb/bitmark-editor/worker` | A worker script that runs the parser off the main thread, for large documents. |
| `@gmb/bitmark-editor-angular` | Angular components (a separate package). |

## Quick start: React

A session with a bitmark pane and a JSON pane, on your app's Monaco:

```tsx
// App.tsx
import { BitmarkPane, BitmarkSession } from '@gmb/bitmark-editor/react';
import { useState } from 'react';

import { monaco } from './monaco';

export const App = () => {
  const [doc, setDoc] = useState('[.article]\nHello **World**!');
  return (
    <BitmarkSession monaco={monaco} theme="light" applyMonacoTheme value={doc} onChange={(e) => setDoc(e.bitmark)}>
      <BitmarkPane type="bitmark" style={{ height: 300 }} />
      <BitmarkPane type="json" style={{ height: 300 }} />
    </BitmarkSession>
  );
};
```

`monaco.ts` is your Monaco, with a worker for each language it includes
(shown for Vite):

```ts
// monaco.ts
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';

self.MonacoEnvironment = {
  getWorker: (_id, label) =>
    label === 'json' ? new jsonWorker() : label === 'html' ? new htmlWorker() : new editorWorker(),
};
export { monaco };
```

### Built-in Monaco

Leave out `monaco-editor`. Copy this package's `dist/bundled` folder into the
app's `public/bitmark-editor/` (for example in a `postinstall` script), and
make `monaco.ts`:

```ts
// monaco.ts: the built-in Monaco, loaded from beside its files.
import { loadBundledMonaco, setBitmarkAssetBase } from '@gmb/bitmark-editor/bundled';

setBitmarkAssetBase('/bitmark-editor/');
export const monaco = await loadBundledMonaco();
```

### Your own parser

Pass it to the session as `engine` (see [Injecting your own parser](#injecting-your-own-parser)):

```tsx
const engine = { module: parser as unknown as RawParserModule, feature: 'full' as const };

<BitmarkSession monaco={monaco} engine={engine} /* … */>
```

<!-- docs-site-links
More: [React](https://getmorebrain.github.io/bitmark-editor/guides/react/).
-->

## Quick start: plain TypeScript

A session with a bitmark pane and a JSON pane, mounted in two elements of the
page, on your app's Monaco:

```html
<div id="bitmark" style="height: 300px"></div>
<div id="json" style="height: 300px"></div>
```

```ts
import { createBitmarkPane, createBitmarkSession, createJsonPane } from '@gmb/bitmark-editor';

import { monaco } from './monaco'; // as for React

const session = createBitmarkSession({
  monaco,
  value: '[.article]\nHello **World**!',
  theme: 'light',
  applyMonacoTheme: true,
});
createBitmarkPane(document.getElementById('bitmark')!, session);
createJsonPane(document.getElementById('json')!, session);
session.on('change', ({ bitmark }) => console.log(bitmark));
```

### Built-in Monaco

Use the built-in `monaco.ts` from [React](#built-in-monaco).

### Your own parser

Pass it to the session as `engine` (see [Injecting your own parser](#injecting-your-own-parser)):

```ts
const session = createBitmarkSession({
  monaco,
  engine: { module: parser as unknown as RawParserModule, feature: 'full' },
  // …
});
```

<!-- docs-site-links
[More](https://getmorebrain.github.io/bitmark-editor/guides/host-with-monaco/),
including Monaco's workers.
-->

## Quick start: a static site (no bundler)

A session with a bitmark pane and a JSON pane. One script tag brings the
elements and the built-in Monaco:

```html
<bitmark-session lazy="idle" theme="auto" value="[.article]&#10;Hello">
  <pre data-bitmark-static>[.article]&#10;Hello</pre>
  <bitmark-pane type="bitmark" style="height: 300px"></bitmark-pane>
  <bitmark-pane type="json" style="height: 300px"></bitmark-pane>
</bitmark-session>
<script type="module" src="https://cdn.jsdelivr.net/npm/@gmb/bitmark-editor@0.1.0-rc.0/dist/bundled/bundled.js"></script>
```

`lazy="idle"` loads Monaco and the parser once the page has rendered. Until
then, the page shows the `data-bitmark-static` content.

### Your own Monaco

Load your Monaco (here AMD, as `window.monaco`), set it on the session, then
load `/elements`, which has no Monaco inside:

```html
<bitmark-session theme="light" apply-monaco-theme value="[.article]&#10;Hello">
  <!-- the panes, as above -->
</bitmark-session>
<script src="/monaco/min/vs/loader.js"></script>
<script type="module">
  require.config({ paths: { vs: '/monaco/min/vs' } });
  const monaco = await new Promise((resolve) => require(['vs/editor/editor.main'], () => resolve(window.monaco)));
  document.querySelector('bitmark-session').monaco = monaco;
  await import('https://cdn.jsdelivr.net/npm/@gmb/bitmark-editor@0.1.0-rc.0/dist/esm/elements/index.js');
</script>
```

### Your own parser

Set it on the session as `engine` (see [Injecting your own parser](#injecting-your-own-parser)),
then load the elements (`/bundled` here, or `/elements` with your Monaco):

```html
<script type="module">
  const parser = await import('https://cdn.jsdelivr.net/npm/@gmb/bitmark-parser@7.9.0/dist/browser/bitmark-parser.min.js');
  await parser.init({ feature: 'full' });
  document.querySelector('bitmark-session').engine = { module: parser, feature: 'full' };
  await import('https://cdn.jsdelivr.net/npm/@gmb/bitmark-editor@0.1.0-rc.0/dist/bundled/bundled.js');
</script>
```

<!-- docs-site-links
[More](https://getmorebrain.github.io/bitmark-editor/guides/static-site/):
loading, self-hosting, caching.
-->

## Injecting your own parser

To use your app's own parser instead of the one the editor loads:

1. `npm install @gmb/bitmark-parser` (7.7 or later).
2. Initialise it before the first session starts:

   ```ts
   import type { RawParserModule } from '@gmb/bitmark-editor';
   import * as parser from '@gmb/bitmark-parser/browser';

   await parser.init({ feature: 'full' }); // however your app initialises it
   ```

3. Pass it to the session as `engine: { module: parser, feature: 'full' }`,
   as each quick start shows.

The editor never calls `init` on a parser you pass in, so `feature` must name
the variant you initialised. The HTML, XML, Text, Info and Mappings panes
need `full`. With `bitmark-json`, only the bitmark and JSON panes work.

In TypeScript, cast the module (`parser as unknown as RawParserModule`): the
parser types `init` as returning `Promise<unknown>`, where the editor expects
`Promise<void>`.

<!-- docs-site-links
More: [the parser](https://getmorebrain.github.io/bitmark-editor/guides/parser/).
-->

## More

[API reference](https://getmorebrain.github.io/bitmark-editor/) ·
[repository](https://github.com/getMoreBrain/bitmark-editor) (development and releases)

<!-- docs-site-links
- Guides: [static site](https://getmorebrain.github.io/bitmark-editor/guides/static-site/),
  [a host with Monaco](https://getmorebrain.github.io/bitmark-editor/guides/host-with-monaco/),
  [React](https://getmorebrain.github.io/bitmark-editor/guides/react/),
  [Angular](https://getmorebrain.github.io/bitmark-editor/guides/angular/),
  [custom elements](https://getmorebrain.github.io/bitmark-editor/guides/elements/),
  [panes](https://getmorebrain.github.io/bitmark-editor/guides/panes/),
  [the session](https://getmorebrain.github.io/bitmark-editor/guides/session/),
  [the parser](https://getmorebrain.github.io/bitmark-editor/guides/parser/),
  [theming](https://getmorebrain.github.io/bitmark-editor/guides/theming/),
  [Content Security Policy](https://getmorebrain.github.io/bitmark-editor/guides/csp/)
- [Live demos](https://getmorebrain.github.io/bitmark-editor/demos/try-it/) and
  [example apps](https://getmorebrain.github.io/bitmark-editor/demos/example-apps/)
  (plain TypeScript, React, Angular)
- [Tested versions](https://getmorebrain.github.io/bitmark-editor/reference/tested-versions/),
  [sizes](https://getmorebrain.github.io/bitmark-editor/reference/sizes/)
-->

## License

ISC
