# Example: plain TypeScript

A Vite app on `@gmb/bitmark-editor`: one session with a bitmark, a JSON and
a read-only HTML pane. See [`src/main.ts`](src/main.ts).

The part to copy is the Monaco setup ([`src/monaco.ts`](src/monaco.ts)): your
Monaco, with a worker for each language it includes. The full `monaco-editor`
import includes HTML, which needs its own worker.

The theme switcher (Auto, Light, Dark) keeps the bitmark token colours and
Monaco's own theme together: the session is created with `theme` and
`applyMonacoTheme: true`, and `session.setTheme()` changes both.

Run it from the repo root as described in [`../README.md`](../README.md),
then `npm run start:example:vanilla-ts` (or `npm run dev` here):
http://localhost:5173.
