# bitmark editor

[![npm](https://img.shields.io/npm/v/@gmb/bitmark-editor?label=%40gmb%2Fbitmark-editor)](https://www.npmjs.com/package/@gmb/bitmark-editor)
[![npm](https://img.shields.io/npm/v/@gmb/bitmark-editor-angular?label=%40gmb%2Fbitmark-editor-angular)](https://www.npmjs.com/package/@gmb/bitmark-editor-angular)
[![Downloads](https://img.shields.io/npm/dm/@gmb/bitmark-editor)](https://www.npmjs.com/package/@gmb/bitmark-editor)
[![Publish](https://github.com/getMoreBrain/bitmark-editor/actions/workflows/publish.yml/badge.svg)](https://github.com/getMoreBrain/bitmark-editor/actions/workflows/publish.yml)
[![License](https://img.shields.io/npm/l/@gmb/bitmark-editor)](./LICENSE)

A bitmark editor built on [Monaco](https://microsoft.github.io/monaco-editor/),
with syntax highlighting, error checking, autocomplete and hover help, for
any framework. Alongside it, optional scroll-linked editors can show the bitmark converted
to JSON, HTML, XML and Text. It uses its own built-in Monaco and bitmark
parser, or the ones your app already has.

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


<!-- docs-site-links
Start with the [docs site](https://getmorebrain.github.io/bitmark-editor/getting-started/):
which build to use, guides for each kind of host, and the API reference.
-->

## Building from source

You need Node 24 and npm.

```bash
npm ci                     # install
npm run build              # the core → packages/bitmark-editor/dist
npm run install:angular    # the Angular project's own install
npm run build:angular      # the Angular library → packages/bitmark-editor-angular/dist
```


## Contributing

This repository is generated at each release, so pull requests can't be merged here. Please
[open an issue](../../issues/new/choose) instead; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This open source software is licensed under the [ISC license](LICENSE).
