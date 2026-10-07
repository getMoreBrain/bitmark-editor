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
- [`angular.json`](angular.json): `"loader": { ".ttf": "file" }` for Monaco's
  icon font, which its CSS imports.

For Angular with zones, Monaco loaded as AMD and an injected parser (as in
cosmic), see the Angular project's own example in
`packages/bitmark-editor-angular/projects/example`.

Run it from the repo root as described in [`../README.md`](../README.md),
then `npm run start:example:angular` (or `npm start` here):
http://localhost:4200.
