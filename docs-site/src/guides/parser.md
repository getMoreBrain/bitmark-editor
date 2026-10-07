---
title: The parser
lead: "@gmb/bitmark-parser does the language work. The editor loads it, or your app injects the one it already has."
---

## Loaded by the editor

By default the editor imports the parser from jsDelivr at a pinned version
({{ site.parserVersion }}), in two stages: `bitmark-json` first, so the
bitmark and JSON panes work quickly, then `full` in the background, for the
other panes.

{% highlight "ts" %}
createBitmarkSession({ monaco });                                          // the pinned version
createBitmarkSession({ monaco, engine: { version: '{{ site.parserVersion }}' } });  // another version
createBitmarkSession({ monaco, engine: { url: '/assets/bitmark-parser.min.js' } }); // self-hosted
{% endhighlight %}

The elements take the same as attributes: `engine-version`, `engine-url`,
`engine-feature`.

## Injected by your app

If your app loads and initialises the parser itself, pass it in:

{% highlight "ts" %}
import * as parser from '@gmb/bitmark-parser/browser';

await parser.init({ feature: 'bitmark-json' });
const session = createBitmarkSession({ monaco, engine: { module: parser, feature: 'bitmark-json' } });

// Later, after your own init({ feature: 'full' }):
session.engine?.setFeature('full');
{% endhighlight %}

The editor never calls `init` on a parser you injected, because a second
`init` would swap your parser's variant. So tell it which variant is active,
as above. The HTML, XML, Text, Info and Mappings panes need `full` (or
`browser-full`). Until then they show "This view needs the full bitmark
parser." The [injected parser demo](/demos/injected-parser/) shows this.

## Large documents: the worker engine

A 351 KB document costs about 190 ms of main-thread work per keystroke. Past
about 100 KB, run the parser in workers:

{% highlight "ts" %}
import { createBitmarkWorkerEngine } from '@gmb/bitmark-editor';
import EngineWorker from '@gmb/bitmark-editor/worker?worker'; // Vite

const engine = await createBitmarkWorkerEngine({ createPort: () => new EngineWorker() });
createBitmarkSession({ monaco, engine });
{% endhighlight %}

With other bundlers, start `@gmb/bitmark-editor/worker`
(`dist/esm/engineWorker.js`) as a module worker however your bundler emits
worker files. With `/bundled`, use `createBundledWorkerEngine({ url? })`.

It uses two workers: a fast lane for highlighting, diagnostics, completion
and hover, and one for conversions.

## What the parser provides

Highlighting (its semantic tokens), diagnostics, completion (bit types
complete to their templates from 7.9), hover, the conversions between bitmark
and the other formats, and where each bit starts, for scroll linking (7.8 and
later). The bitmark language itself is documented on the
[bitmark site]({{ site.parserDocs }}).
