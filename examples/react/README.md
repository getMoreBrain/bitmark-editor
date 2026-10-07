# Example: React

A React 19 app on `@gmb/bitmark-editor/react`. See [`src/App.tsx`](src/App.tsx):

- `<BitmarkSession monaco={monaco} value={bitmark} onChange={…}>` holds one
  document. Feeding your own state back as `value` is safe: the session
  recognises its own edits.
- `<BitmarkPane type="…">` mounts a pane in a `<div>` you size. That `<div>`
  has `height: 100%` (and `box-sizing: border-box`) by default. Here each
  pane sits in a flex card under its label, so the app passes
  `style={{ height: 'auto' }}` and lets the card size it.

- `theme` and `applyMonacoTheme` on `<BitmarkSession>` keep the token
  colours and Monaco's own theme together. The theme switcher just changes
  `theme`.

The Monaco setup ([`src/monaco.ts`](src/monaco.ts)) is the same as the plain
TypeScript example.

Run it from the repo root as described in [`../README.md`](../README.md),
then `npm run start:example:react` (or `npm run dev` here):
http://localhost:5174.
