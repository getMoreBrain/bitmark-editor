---
title: Getting started
permalink: /getting-started/
lead: Pick the build that fits your page, install it, and add a session with its panes.
---

## The packages

| Entry | What it is |
|---|---|
| `@gmb/bitmark-editor` | The core: engine, session, panes, themes, scroll linking. No Monaco inside. |
| `@gmb/bitmark-editor/elements` | Custom elements over the core. Importing it defines them. |
| `@gmb/bitmark-editor/react` | React components: `<BitmarkSession>`, `<BitmarkPane>`. |
| `@gmb/bitmark-editor/bundled` | The custom elements with their own Monaco, for pages without one. CDN-ready. |
| `@gmb/bitmark-editor/worker` | The engine's worker script, for large documents. |
| `@gmb/bitmark-editor-angular` | Angular components. A separate package. |

## Which build?

Your page **already has Monaco** (an ESM import, or an AMD `window.monaco`):
use the core, `/elements`, React or Angular, and pass your Monaco in. There is
one Monaco on the page. Monaco 0.46 up to the current release is supported.
See [A host with Monaco](/guides/host-with-monaco/).

Your page **has no Monaco**, or no bundler: use `/bundled`, which brings
Monaco 0.57. If the page does have a Monaco after all, `/bundled` warns and
leaves it alone. See [Static site](/guides/static-site/).

## Install

{% highlight "sh" %}
npm install @gmb/bitmark-editor monaco-editor
{% endhighlight %}

Add `@gmb/bitmark-editor-angular` for Angular. With `/bundled` from the CDN,
there is nothing to install:

{% highlight "html" %}
<script type="module" src="{{ site.cdn }}"></script>
{% endhighlight %}

## Peer dependencies

All of them are optional: each is needed only by the entry that uses it.

| Peer | Range | Needed by |
|---|---|---|
| `monaco-editor` | `>=0.46 <1` | the core, `/elements`, React and Angular (your Monaco) |
| `react` | `>=18` | `/react` |
| `@angular/core` | `>=21 <23` | `@gmb/bitmark-editor-angular` |
| `@gmb/bitmark-parser` | `>=7.7 <8` | only if your app loads the parser itself ([The parser](/guides/parser/)) |

Without `@gmb/bitmark-parser`, the editor loads the parser from jsDelivr at a
pinned version ({{ site.parserVersion }}).

## The model

- A **session** holds one bitmark document, the source of truth.
- **Panes** are Monaco editors that you mount anywhere: bitmark, JSON, HTML,
  XML, Text, Info and Mappings. Editing any pane converts it to bitmark, and
  the other panes follow. See [Panes](/guides/panes/).
- The **parser** does the language work: highlighting, errors, completion,
  hover and the conversions.

Next: the guide for your setup, or the [example apps](/demos/example-apps/),
complete and ready to copy.
