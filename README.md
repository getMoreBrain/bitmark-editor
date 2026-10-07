# bitmark editor

[![CI](https://github.com/getMoreBrain/bitmark-editor/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/getMoreBrain/bitmark-editor/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@gmb/bitmark-editor?label=%40gmb%2Fbitmark-editor)](https://www.npmjs.com/package/@gmb/bitmark-editor)
[![npm](https://img.shields.io/npm/v/@gmb/bitmark-editor-angular?label=%40gmb%2Fbitmark-editor-angular)](https://www.npmjs.com/package/@gmb/bitmark-editor-angular)

A bitmark editor built on [Monaco](https://microsoft.github.io/monaco-editor/),
with syntax highlighting, error checking, autocomplete and hover help, for
any framework. Alongside it, optional scroll-linked editors can show the bitmark converted
to JSON, HTML, XML and Text. It uses its own built-in Monaco and bitmark
parser, or the ones your app already has.

> Pre-release: 0.1.0 is not yet published.

**[API reference](https://getmorebrain.github.io/bitmark-editor/)**

<!-- docs-site-links: hidden until the docs site is deployed (only the API reference is). To show them, remove the comment.
**[Documentation and live demos](https://getmorebrain.github.io/bitmark-editor/)** ·
[Try it](https://getmorebrain.github.io/bitmark-editor/demos/try-it/)
-->

## Packages

| Package | What it is |
|---|---|
| [`@gmb/bitmark-editor`](packages/bitmark-editor/README.md) | The editor, for any framework: a TypeScript API, React components, and custom elements for plain HTML pages (including a build that loads from a CDN with its own Monaco). |
| [`@gmb/bitmark-editor-angular`](packages/bitmark-editor-angular/projects/bitmark-editor-angular/README.md) | Angular components for the editor, usable as a form control. |

## Quick start

Pick your host:

| Host | Install | Quick start |
|---|---|---|
| React | `npm install @gmb/bitmark-editor monaco-editor` | [core README](packages/bitmark-editor/README.md#quick-start-react) |
| Angular | `npm install @gmb/bitmark-editor @gmb/bitmark-editor-angular monaco-editor` | [Angular README](packages/bitmark-editor-angular/projects/bitmark-editor-angular/README.md) |
| Plain TypeScript | `npm install @gmb/bitmark-editor monaco-editor` | [core README](packages/bitmark-editor/README.md#quick-start-plain-typescript) |
| Static site, no bundler | nothing: one `<script>` from the CDN | [core README](packages/bitmark-editor/README.md#quick-start-a-static-site-no-bundler) |

<!-- docs-site-links
Guides: [React](https://getmorebrain.github.io/bitmark-editor/guides/react/),
[Angular](https://getmorebrain.github.io/bitmark-editor/guides/angular/),
[a host with Monaco](https://getmorebrain.github.io/bitmark-editor/guides/host-with-monaco/),
[static site](https://getmorebrain.github.io/bitmark-editor/guides/static-site/),
[the parser](https://getmorebrain.github.io/bitmark-editor/guides/parser/).
-->

To start from a complete app instead, see the [example apps](examples/):
[plain TypeScript](examples/vanilla-ts/), [React](examples/react/) and
[Angular](examples/angular/).

<!-- docs-site-links
Start with the [docs site](https://getmorebrain.github.io/bitmark-editor/getting-started/):
which build to use, guides for each kind of host, and the API reference.
-->

## Repository layout

```text
packages/bitmark-editor/            @gmb/bitmark-editor (npm workspace)
  src/                              engine/, monaco/, session/, panes/, scroll/, theme/,
                                    editor/, elements/, react/, bundled/
  examples/                         static-site and /esm examples, with browser checks
                                    (npm workspace)
  docs/                             integration notes for specific apps that use the editor
packages/bitmark-editor-angular/    Angular CLI project: the library and an example shaped
                                    like cosmic, an Angular app of ours with its own AMD
                                    Monaco and parser (standalone npm project)
examples/                           example apps: vanilla-ts, react, angular (each its own
                                    npm project, installed from packed tarballs)
docs-site/                          the docs site (Eleventy, Pagefind; npm workspace),
                                    built and tested in CI, not yet deployed; GitHub
                                    Pages serves only the API reference
scripts/                            release.mjs (one version for both packages),
                                    example-apps.mjs (pack, install, build, test the apps)
.awa/                               the architecture spec and implementation plans
```

The Angular project is not in the root npm workspace. It pins Monaco 0.46
and its own TypeScript to match cosmic, and builds against the core's build
output (`dist`).

## Development

You need Node 24 and npm. Install the workspace, build the core, then run
any of the checks. The docs site, the Angular project and the example apps
each build on the core's build output, so build the core first.

```bash
# The core
npm ci                     # install the workspace: the core, its examples, the docs site
npm run build              # build the core → packages/bitmark-editor/dist
npm run lint
npm run typecheck
npm test                   # unit tests
npm run test:browser       # browser tests
npm run check:package      # check what npm would publish

# The docs
npm run build:docs         # the API reference → packages/bitmark-editor/docs/api
npm run build:site         # the docs site (after build:docs) → docs-site/_site
npm run test:site          # the docs site's smoke tests
npm run start:site         # the docs site's dev server: http://localhost:8080

# The Angular package
npm run install:angular    # its own install
npm run build:angular
npm run test:angular       # end-to-end tests of its cosmic-shaped example
npm run check:package:angular

# The example apps (after build and build:angular)
npm run pack:examples      # pack both packages as the apps install them
npm run install:examples
npm run build:examples
npm run test:examples
npm run start:example:react   # a dev server; or :vanilla-ts, :angular

# Maintenance
npm run bump:parser        # update the parser version the editor loads by default to the latest 7.x
```

## Releasing

Both packages release together, from a `v<version>` tag, by npm trusted
publishing. See [RELEASING.md](RELEASING.md).

## License

This open source software is licensed under the [ISC license](LICENSE).
