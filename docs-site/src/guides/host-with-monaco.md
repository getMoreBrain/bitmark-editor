---
title: A host with Monaco
lead: Your app already has Monaco. Pass it in, mount the panes you want, and listen for changes.
---

{% highlight "ts" %}
import * as monaco from 'monaco-editor';
import { createBitmarkSession, createBitmarkPane, createJsonPane, createHtmlPane } from '@gmb/bitmark-editor';

const session = createBitmarkSession({
  monaco,                                   // your Monaco: its workers, its theme
  value: '[.article]\nHello **World**!',
  theme: 'light',                           // match your Monaco's theme (below)
  // no engine: the parser loads from jsDelivr at the pinned version
});
createBitmarkPane(document.getElementById('bitmark')!, session);
createJsonPane(document.getElementById('json')!, session);
createHtmlPane(document.getElementById('html')!, session, { readOnly: true });
session.on('change', ({ bitmark }) => save(bitmark));
{% endhighlight %}

The [plain TypeScript example app](/demos/example-apps/) is this setup,
complete.

## Match the theme to your Monaco

`theme` sets the bitmark token colours, and defaults to `dark`. Your Monaco
keeps its own theme, which is page-wide and starts as light `vs`. Left alone,
that gives dark-theme colours on a white editor, which are hard to read, and
the session warns once in the console. Either:

- set `theme` to match your Monaco's theme: `'light'` for `vs`, `'dark'` for
  `vs-dark`; or
- pass `applyMonacoTheme: true`, and the session sets Monaco's theme from
  `theme` too, including `'auto'`, which follows the OS. Use it when the
  page's Monaco is yours to theme.

More in [Theming](/guides/theming/).

## What your Monaco needs

- The **JSON language**, for the JSON pane's schema checks, and the **suggest**
  and **hover** contributions, for completion and hover. If one is missing,
  that feature is off and a warning is logged once; nothing breaks.
- **A worker for each language you include**, set up as for any Monaco
  editor: `json` for the JSON pane, and `html` if your Monaco includes the HTML
  language (the full `monaco-editor` import does). Without it, the HTML
  language's requests reach the generic editor worker and fail.

With Vite:

{% highlight "ts" %}
import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import htmlWorker from 'monaco-editor/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker?worker';

self.MonacoEnvironment = {
  getWorker: (_id, label) =>
    label === 'json' ? new jsonWorker() : label === 'html' ? new htmlWorker() : new editorWorker(),
};
{% endhighlight %}

From Monaco 0.57, the worker files are under `monaco-editor/editor/…` and
`monaco-editor/language/…`. Earlier versions use `monaco-editor/esm/vs/…`.

## What the bitmark pane does

- It highlights, marks errors, and offers completion and hover, all from the
  parser.
- It auto-closes `[`: the language declares the `[` `]` pair, as the VS Code
  extension does. A `bitmark` language your app registered first keeps its
  own configuration.
- It completes a bit type to its template (parser 7.9 and later): `[.art` and
  Enter insert `[.article]` with the bit's usual tags and body, as a snippet.

## Custom elements with your Monaco

`@gmb/bitmark-editor/elements` defines the same elements as `/bundled`,
without Monaco. Set `monaco` on the session element before it starts:

{% highlight "ts" %}
import '@gmb/bitmark-editor/elements';
document.querySelector('bitmark-session').monaco = monaco;
{% endhighlight %}

See [Custom elements](/guides/elements/).

## Monaco and DOMPurify

Monaco vendors its own copy of DOMPurify, the HTML sanitiser for hovers and
Markdown. With your own Monaco, keeping that copy current is up to your
Monaco version. Monaco 0.57 ships 3.4.15, which has a low-severity advisory.
