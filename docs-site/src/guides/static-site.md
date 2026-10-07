---
title: Static site (/bundled)
lead: A static page with no bundler and no Monaco of its own. One script tag brings the editor, Monaco and its workers.
---

{% highlight "html" %}
<bitmark-session lazy="idle" narrow="static" theme="auto" value="[.article]&#10;Hello">
  <pre data-bitmark-static>[.article]&#10;Hello</pre>   <!-- shown until the editor is ready -->
  <bitmark-pane type="bitmark" style="height: 300px"></bitmark-pane>
  <bitmark-pane type="json" style="height: 300px"></bitmark-pane>
</bitmark-session>
<script type="module" src="{{ site.cdn }}"></script>
{% endhighlight %}

The [Try it demo](/demos/try-it/) is this setup.

## Loading

- `lazy`: when Monaco and the parser load. `idle` (after the page renders),
  `click`, `focus`, `visible`, or none (straight away). A `click` or `focus`
  session needs something to click, so put static content inside it.
- `narrow`: what happens on a phone (a coarse pointer *and* a narrow
  viewport). `static` keeps the static content, `readonly` makes the panes
  read-only, and `edit` (the default) changes nothing.
- If the CDN can't be reached, the static content stays.

The static content is any child with `data-bitmark-static`. It is shown until
the session is ready, and the panes from then on.

## Versions and caching

Pin the version in the URL, as above. jsDelivr then serves the files as
immutable, and every page after the first loads them from the browser cache.
The editor loads the parser from jsDelivr at its own pinned version
({{ site.parserVersion }}), with the same caching.

## Self-hosting

To serve the files yourself, copy the package's `dist/bundled` folder as it
is: `bundled.js` loads `monaco.js`, `monaco.css`, the font and the workers
from beside itself. If your build tool moves `bundled.js` away from its
siblings, tell it where they are before the first session starts:

{% highlight "js" %}
import { setBitmarkAssetBase } from '@gmb/bitmark-editor/bundled';
setBitmarkAssetBase('/assets/bitmark-editor/');
{% endhighlight %}

To keep the parser on your origin too, see [The parser](/guides/parser/), and
for the headers, [Content Security Policy](/guides/csp/).

## Monaco and DOMPurify

Monaco vendors its own copy of DOMPurify, the HTML sanitiser for hovers and
Markdown. `/bundled` replaces Monaco 0.57's copy (3.4.15, which has a
low-severity advisory) with the patched 3.4.16.

## Elements

The elements, their attributes and events are in [Custom elements](/guides/elements/).
