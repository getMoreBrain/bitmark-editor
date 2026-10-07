# bitmark editor

[![CI](https://github.com/getMoreBrain/bitmark-editor/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/getMoreBrain/bitmark-editor/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gmb/bitmark-editor?label=%40gmb%2Fbitmark-editor)](https://www.npmjs.com/package/@gmb/bitmark-editor)
[![npm](https://img.shields.io/npm/v/@gmb/bitmark-editor-angular?label=%40gmb%2Fbitmark-editor-angular)](https://www.npmjs.com/package/@gmb/bitmark-editor-angular)

bitmark and JSON editors on Monaco, with optional HTML, XML, Text, Info and
Mappings panes, for any framework. Editing any pane updates the others,
through the bitmark parser.

**[Try it](https://getmorebrain.github.io/bitmark-editor/try-it.html)** ·
[Demos and API reference](https://getmorebrain.github.io/bitmark-editor/)

> Pre-release: 0.1.0 is not yet published.

## Packages

| Package | What it is |
|---|---|
| [`@gmb/bitmark-editor`](packages/bitmark-editor/README.md) | The core (engine, session, panes, themes, scroll linking), custom elements, a React adapter, and a CDN-ready `/bundled` build with its own Monaco. |
| [`@gmb/bitmark-editor-angular`](packages/bitmark-editor-angular/projects/bitmark-editor-angular/README.md) | Angular components: `bm-session`, `bm-pane`, `bm-tabs`, `bm-split`, with forms support. |

Start with the [core README](packages/bitmark-editor/README.md). It says
which build to use, with quick starts for a host that already has Monaco and
for a static site without a bundler.

Guides for specific hosts are in [`packages/bitmark-editor/docs/`](packages/bitmark-editor/docs/):

- [`handoff-cosmic.md`](packages/bitmark-editor/docs/handoff-cosmic.md): an
  Angular app with its own AMD Monaco and parser;
- [`handoff-docs-site.md`](packages/bitmark-editor/docs/handoff-docs-site.md):
  a static Eleventy site;
- [`handoff-playground.md`](packages/bitmark-editor/docs/handoff-playground.md):
  the bitmark Playground, a React app on Vite.

## Repository layout

```text
packages/bitmark-editor/            @gmb/bitmark-editor (npm workspace)
  src/                              engine/, monaco/, session/, panes/, scroll/, theme/,
                                    editor/, elements/, react/, bundled/
  examples/                         static-site and /esm examples, the GitHub Pages
                                    site (pages/), browser checks (npm workspace)
  docs/                             hand-offs to host apps
packages/bitmark-editor-angular/    Angular CLI project: the library and a cosmic-shaped
                                    example (standalone npm project)
scripts/release.mjs                 one version for both packages
.awa/                               architecture and plans
```

The Angular project is not in the root npm workspace. It pins Monaco 0.46
and its own TypeScript to match cosmic, and builds against the core's `dist`.

## Development

Node 24 (`.nvmrc`) and npm. The devcontainer sets both up.

```bash
npm ci                    # the workspace: the core and its examples
npm run lint
npm run typecheck
npm test                  # unit tests (Vitest, jsdom)
npm run build             # dist/esm, dist/types, dist/bundled
npm run examples:test     # browser checks, including the Pages site (Playwright)
npm run pack:check        # what npm would publish, publint, attw
npm run docs              # API reference (typedoc) → packages/bitmark-editor/docs/api

npm run angular:install   # the Angular project (after npm run build)
npm run angular:build
npm run angular:test      # e2e: Monaco 0.46 AMD, injected parser
npm run angular:pack:check
```

CI ([`ci.yml`](.github/workflows/ci.yml)) runs all of these on every PR.
`main` needs a PR, with the `core` and `angular` checks green.

The default parser version is pinned in the core. A weekly workflow opens a
PR when a newer `@gmb/bitmark-parser` is out within the supported major.

## Releasing

Both packages release together, from a `v<version>` tag, by npm trusted
publishing. See [RELEASING.md](RELEASING.md).

## License

This open source software is licensed under the [ISC license](LICENSE).
