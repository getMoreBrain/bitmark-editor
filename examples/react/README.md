# Example: React

A React 19 app on `@gmb/bitmark-editor/react`. See [`src/App.tsx`](src/App.tsx):

- `<BitmarkSession monaco={monaco} value={bitmark} onChange={…}>` holds one
  document. Feeding your own state back as `value` is safe: the session
  recognises its own edits.
- `<BitmarkPane type="…">` mounts a pane in a `<div>` you size. It sets
  `height: 100%` on that `<div>`, so give the pane's container a definite
  height. Use `box-sizing: border-box` if you add a border or padding: with
  `content-box`, the extra pixels can make a grid or flex container grow
  forever.

The Monaco setup ([`src/monaco.ts`](src/monaco.ts)) is the same as the plain
TypeScript example.

Run it from the repo root as described in [`../README.md`](../README.md),
then `npm run dev` here.
