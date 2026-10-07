---
title: Tested versions
lead: CI tests both ends of each peer range, on every change.
---

| Peer | Range | Tested |
|---|---|---|
| `monaco-editor` | `>=0.46 <1` | 0.46 (the Angular wrapper's example, loaded as AMD) and 0.57 (`/bundled`, the example apps) |
| `react` | `>=18` | 18 and 19 (the React adapter's tests and typecheck; the React example app on 19) |
| `@angular/core` | `>=21 <23` | 21 and 22 (`@gmb/bitmark-editor-angular`, built and tested on both) |
| `@gmb/bitmark-parser` | `>=7.7 <8` | the pinned default, {{ site.parserVersion }} |

Browsers: the checks run in Chromium (Playwright). The packages use standard
ES2022, custom elements and Web Workers, with no browser-specific code.

Node is needed only for building and tooling: version 22 or later.
