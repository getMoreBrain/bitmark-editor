---
title: Sizes
lead: What /bundled loads, and when. Brotli-compressed, as a CDN serves it.
---

| File | Size | Loaded |
|---|---|---|
| `bundled.js` | 15 KB | on import |
| `monaco.js` + `monaco.css` + `codicon.ttf` | 809 + 22 + 66 KB | when the first session starts |
| `editor.worker.js`, `json.worker.js` | 74, 104 KB | on first use |
| the parser + `bitmark-json` wasm (+ `full`) | 13 + 222 (+ 346) KB | when the first session starts |

With `lazy="idle"`, `click`, `focus` or `visible`, a page pays only for
`bundled.js` until then ([Static site](/guides/static-site/#loading)). From a
CDN, at a pinned version, every page after the first loads all of it from the
browser cache.

With your own Monaco, the package adds only the core: about 76 KB minified
for the core, `/elements` and `/react` together, before compression.
