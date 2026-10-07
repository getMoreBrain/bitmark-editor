# Example: Angular

A zoneless Angular 21 app on `@gmb/bitmark-editor-angular`.

- [`src/app/app.config.ts`](src/app/app.config.ts):
  `provideBitmarkEditor({ monaco: () => import('./monaco') … })` gives every
  `bm-session` its Monaco. It is loaded on first use, so the app's initial
  bundle stays small.
- [`src/app/app.html`](src/app/app.html): `bm-session` bound to a
  `FormControl` (`[formControl]`), with `bm-pane` children.
- [`src/app/monaco.ts`](src/app/monaco.ts): the workers, as
  `new Worker(new URL('./workers/…', import.meta.url), { type: 'module' })`,
  which Angular's builder bundles.
- Monaco's styles: Angular's builder doesn't attach the CSS that Monaco's
  lazily loaded code imports. So [`angular.json`](angular.json) builds
  Monaco's prebuilt stylesheet as `monaco.css` (`"inject": false`), and
  `loadMonaco()` in [`src/app/monaco.ts`](src/app/monaco.ts) attaches it
  before the first editor. Without it the editors work, but unstyled.
  `"loader": { ".ttf": "file" }` handles the icon font that Monaco's own CSS
  imports.
- Themes: `bm-session`'s `[theme]` sets the token colours. Monaco's own theme
  is page-wide and `bm-session` doesn't set it, so the app does
  (`monaco.editor.setTheme`, following the OS for Auto). See
  [`src/app/app.ts`](src/app/app.ts).

For Angular with zones, Monaco loaded as AMD and an injected parser (as in
cosmic), see the Angular project's own example in
`packages/bitmark-editor-angular/projects/example`.

Run it from the repo root as described in [`../README.md`](../README.md),
then `npm run start:example:angular` (or `npm start` here):
http://localhost:4200.
