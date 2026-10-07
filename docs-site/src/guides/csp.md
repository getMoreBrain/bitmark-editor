---
title: Content Security Policy
lead: What a strict Content Security Policy must allow for the editor. Checked against /bundled from a CDN origin.
---

| Directive | Allow | For |
|---|---|---|
| `script-src` | the CDN origin (`https://cdn.jsdelivr.net`), or `'self'` when self-hosting; and `'wasm-unsafe-eval'` | the editor's and the parser's scripts, and the parser's WebAssembly |
| `worker-src` | `blob:` | `/bundled`'s Monaco workers |
| `connect-src` | the CDN origin, or `'self'` | the parser's WebAssembly and the JSON schema |
| `style-src` | the CDN origin, or `'self'`; and `'unsafe-inline'` | Monaco's stylesheet, and the `<style>` elements Monaco and the panes add at runtime |
| `font-src` | the CDN origin, or `'self'` | Monaco's icon font |

For `/bundled` and the parser from jsDelivr, that is:

{% highlight "text" %}
script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval';
worker-src blob:;
connect-src 'self' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
font-src 'self' https://cdn.jsdelivr.net
{% endhighlight %}

<div class="note">

Without the `style-src` and `font-src` entries, the editor still starts, but
unstyled: no editor background, theme or icons. `'unsafe-inline'` is needed
for styles only, because Monaco and the panes insert `<style>` elements.
Scripts need no `'unsafe-inline'`.

</div>

To keep everything on your own origin, self-host both and use `'self'`:

- the editor's `dist/bundled` folder ([Static site](/guides/static-site/#self-hosting));
- the parser's `dist/browser` folder, with `engine-url` or `engine: { url }`
  pointing at it ([The parser](/guides/parser/)).

With your own Monaco, the workers, styles and fonts follow your Monaco setup.
The parser still needs `script-src` with `'wasm-unsafe-eval'`, and
`connect-src`, for wherever it loads from.
