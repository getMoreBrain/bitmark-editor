# @gmb/bitmark-editor

bitmark and JSON editors on Monaco, with optional HTML, XML, Text, Info and
Mappings panes, for any framework. Editing any pane updates the others,
through the bitmark parser.

<!-- docs-site-links: links into the guides; the API reference leaves them out while the guides are hidden (docs-site/src/_data/site.js) -->
**Documentation, guides and live demos: https://getmorebrain.github.io/bitmark-editor/**
<!-- /docs-site-links -->

> Pre-release: 0.1.0, not yet published.

| Entry | What it is |
|---|---|
| `@gmb/bitmark-editor` | The core: engine, session, panes, themes, scroll linking. No Monaco inside. |
| `@gmb/bitmark-editor/elements` | Custom elements over the core (defines them on import). |
| `@gmb/bitmark-editor/react` | React components: `<BitmarkSession>`, `<BitmarkPane>`. |
| `@gmb/bitmark-editor/bundled` | The elements with their own Monaco, for pages without one (CDN-ready). |
| `@gmb/bitmark-editor/worker` | The engine worker script, for large documents. |
| `@gmb/bitmark-editor-angular` | Angular components (a separate package). |

## Install

```sh
npm install @gmb/bitmark-editor monaco-editor
```

Your page already has Monaco: use the core, `/elements`, React or Angular,
and pass your Monaco in. It doesn't: use `/bundled`, which brings Monaco
0.57.

<!-- docs-site-links -->
[Which build?](https://getmorebrain.github.io/bitmark-editor/getting-started/)
<!-- /docs-site-links -->

## Quick start: a host with Monaco

```ts
import * as monaco from 'monaco-editor';
import { createBitmarkSession, createBitmarkPane, createJsonPane } from '@gmb/bitmark-editor';

const session = createBitmarkSession({
  monaco,                                   // your Monaco: its workers, its theme
  value: '[.article]\nHello **World**!',
  theme: 'light',                           // match your Monaco's theme
});
createBitmarkPane(document.getElementById('bitmark')!, session);
createJsonPane(document.getElementById('json')!, session);
session.on('change', ({ bitmark }) => save(bitmark));
```

`theme` sets the bitmark token colours (default `dark`); your Monaco keeps
its own, page-wide theme (light `vs` unless you set one). Match the two, or
pass `applyMonacoTheme: true`.

<!-- docs-site-links -->
[More](https://getmorebrain.github.io/bitmark-editor/guides/host-with-monaco/),
including Monaco's workers.
<!-- /docs-site-links -->

## Quick start: a static site (no bundler)

```html
<bitmark-session lazy="idle" theme="auto" value="[.article]&#10;Hello">
  <pre data-bitmark-static>[.article]&#10;Hello</pre>
  <bitmark-pane type="bitmark" style="height: 300px"></bitmark-pane>
  <bitmark-pane type="json" style="height: 300px"></bitmark-pane>
</bitmark-session>
<script type="module" src="https://cdn.jsdelivr.net/npm/@gmb/bitmark-editor@0.1.0-rc.0/dist/bundled/bundled.js"></script>
```

<!-- docs-site-links -->
[More](https://getmorebrain.github.io/bitmark-editor/guides/static-site/):
loading, self-hosting, caching.
<!-- /docs-site-links -->

## Documentation

<!-- docs-site-links -->
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
- [API reference](https://getmorebrain.github.io/bitmark-editor/api/),
  [tested versions](https://getmorebrain.github.io/bitmark-editor/reference/tested-versions/),
  [sizes](https://getmorebrain.github.io/bitmark-editor/reference/sizes/)
<!-- /docs-site-links -->

Development and releases: the [repository](https://github.com/getMoreBrain/bitmark-editor).

## License

ISC
