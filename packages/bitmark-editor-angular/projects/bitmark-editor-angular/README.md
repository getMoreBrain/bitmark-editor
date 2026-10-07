# @gmb/bitmark-editor-angular

A bitmark editor for Angular 21 and 22, built on
[Monaco](https://microsoft.github.io/monaco-editor/), with syntax
highlighting, error checking, autocomplete and hover help. Alongside it,
optional scroll-linked editors can show the bitmark converted to JSON, HTML,
XML and Text. It uses its own built-in Monaco and bitmark parser, or the ones
your app already has.

These are the Angular components for
[`@gmb/bitmark-editor`](https://www.npmjs.com/package/@gmb/bitmark-editor).

<!-- docs-site-links: hidden until the docs site is deployed. To show it, remove the comment.
**Guide: https://getmorebrain.github.io/bitmark-editor/guides/angular/**
-->

## Install

```sh
npm install @gmb/bitmark-editor @gmb/bitmark-editor-angular monaco-editor
```

`monaco-editor` is only needed when you inject your own Monaco.

## How it works

- **`bm-session`** holds one bitmark document. It is a form control
  (`formControl`, `formControlName`, `ngModel`) whose value is the bitmark
  text.
- **`bm-pane`** is one editor on the session around it: bitmark, JSON, HTML,
  XML, Text, Info or Mappings. Editing the bitmark, JSON, HTML or XML pane
  updates the others.
- **`bm-split`** lays its panes out side by side or stacked, and
  **`bm-tabs`** shows them as tabs. A pane fills the space it is given, so
  give the session (or the element around the panes) a height.
- **`provideBitmarkEditor`**, in the app's providers, sets the defaults for
  every session: which Monaco, which parser, the theme.

Monaco and the parser can each be built-in or injected:

- **Monaco.** An app usually injects its own Monaco, set up with its workers
  as usual. Without one, use the built-in Monaco (0.57, its workers set up
  for you): see [Built-in Monaco](#built-in-monaco). An injected Monaco
  keeps its own, page-wide theme: set `applyMonacoTheme` and each session
  sets Monaco's theme to match its own.
- **The parser.** By default the editor loads it from jsDelivr, at a version
  pinned in `@gmb/bitmark-editor`. To inject your own, see
  [Injecting your own parser](#injecting-your-own-parser).

Monaco and the sessions run outside the Angular zone, and the outputs
re-enter it. Typing in an editor doesn't trigger change detection; each
document change does, once.

## Quick start

Set the defaults in the app's providers. Here, your Monaco loads the first
time a session starts:

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideBitmarkEditor } from '@gmb/bitmark-editor-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBitmarkEditor({
      monaco: () => import('./monaco').then((m) => m.loadMonaco()),
      applyMonacoTheme: true,
    }),
  ],
};
```

Then use the components, with the document in a form control:

```ts
// app.ts
import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BmPaneComponent, BmSessionComponent, BmSplitComponent } from '@gmb/bitmark-editor-angular';

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, BmSessionComponent, BmPaneComponent, BmSplitComponent],
  template: `
    <bm-session [formControl]="content" theme="light" style="height: 320px">
      <bm-split>
        <bm-pane type="bitmark" />
        <bm-pane type="json" />
      </bm-split>
    </bm-session>
  `,
})
export class App {
  protected readonly content = new FormControl('[.article]\nHello **World**!', { nonNullable: true });
}
```

`monaco.ts` is your Monaco. Its `loadMonaco()` sets up Monaco's workers and
attaches Monaco's stylesheet, which Angular's builder doesn't do for code
loaded on first use. Copy it from the example app:
[`monaco.ts`](https://github.com/getMoreBrain/bitmark-editor/blob/main/examples/angular/src/app/monaco.ts),
its [workers](https://github.com/getMoreBrain/bitmark-editor/tree/main/examples/angular/src/app/workers),
and the `monaco` stylesheet entry in its
[`angular.json`](https://github.com/getMoreBrain/bitmark-editor/blob/main/examples/angular/angular.json).

### Built-in Monaco

Leave out `monaco-editor`, and use the Monaco built into
`@gmb/bitmark-editor`. Copy its files into the build, in `angular.json`
(`architect.build.options.assets`):

```json
{ "glob": "**/*", "input": "node_modules/@gmb/bitmark-editor/dist/bundled", "output": "bitmark-editor" }
```

and load it in the providers instead of `./monaco`:

```ts
provideBitmarkEditor({
  monaco: async () => {
    const { loadBundledMonaco, setBitmarkAssetBase } = await import('@gmb/bitmark-editor/bundled');
    setBitmarkAssetBase('/bitmark-editor/');
    return loadBundledMonaco();
  },
  applyMonacoTheme: true,
}),
```

### Injecting your own parser

Initialise your parser before the first session starts, and pass it as
`engine`. Sessions start once `monaco` resolves, so wait for the parser
there:

```ts
import type { RawParserModule } from '@gmb/bitmark-editor';
import * as parser from '@gmb/bitmark-parser/browser';

const parserReady = parser.init({ feature: 'full' }); // however your app initialises it

provideBitmarkEditor({
  monaco: async () => {
    await parserReady;
    return (await import('./monaco')).loadMonaco();
  },
  engine: () => ({ module: parser as unknown as RawParserModule, feature: 'full' }),
}),
```

`feature` must name the variant you initialised, and the cast is needed in
TypeScript: see
[Injecting your own parser](https://www.npmjs.com/package/@gmb/bitmark-editor#injecting-your-own-parser)
in the core package.

## Components

`bm-session`

| Input | |
|---|---|
| `value` | The document, when not used as a form control. A new value replaces it |
| `theme` | `dark` (default), `light`, `auto` (follows the OS), or a custom theme |
| `applyMonacoTheme` | Set Monaco's page-wide theme to match `theme` |
| `monaco`, `engine` | Override the provider's Monaco and parser for this session |
| `debounceMs` | Wait for a pause in typing, in milliseconds, before converting |
| `schema` | The JSON schema for the JSON pane: an object, a URL, or `false` |

| Output | |
|---|---|
| `change` | The document changed: `{ bitmark, source }` |
| `ready` | The parser has loaded |
| `error` | Something failed, for example loading the parser |

`bm-pane`

| Input | |
|---|---|
| `type` | `bitmark` (default), `json`, `html`, `xml`, `text`, `info` or `mappings` |
| `readonly` | Read-only |
| `label` | The pane's label: its tab in `bm-tabs`, and its accessible name |
| `mode` | JSON: `optimized` (default) or `full` |
| `mapping` | XML: the mapping to use |
| `scrollSync` | Take part in scroll linking |
| `editorOptions` | Options passed to the pane's Monaco editor, for example `{ stickyScroll: { enabled: false } }` |
| `inactive` | Don't mount the pane |

`bm-split`: `direction`, `row` (default) or `column`.
`bm-tabs`: `[(active)]`, the index of the open tab, and `tabLabels`. Only
the open tab's pane is mounted.

## Example apps

- [The Angular example app](https://github.com/getMoreBrain/bitmark-editor/tree/main/examples/angular):
  a complete zoneless app, with the setup above.
- [An NgModule example](https://github.com/getMoreBrain/bitmark-editor/tree/main/packages/bitmark-editor-angular/projects/example):
  zone change detection, Monaco 0.46 loaded as AMD (`window.monaco`), and
  the app's own parser.

## License

ISC
