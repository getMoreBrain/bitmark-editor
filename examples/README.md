# Example apps

Three small apps that use the packages as an outside host would. Start from
the one that matches your app.

| App | Shows |
|---|---|
| [`vanilla-ts`](vanilla-ts/) | Plain TypeScript on Vite: `createBitmarkSession` and panes, with your own Monaco. |
| [`react`](react/) | React 19 on Vite: `<BitmarkSession>` and `<BitmarkPane>`, with the document in state. |
| [`angular`](angular/) | A zoneless Angular 21 app: `provideBitmarkEditor`, and `bm-session` as a form control. Monaco loads on first use. |

All three have a theme switcher (Auto, Light, Dark) that keeps the bitmark
token colours and Monaco's own theme together. All three use Monaco 0.57 from npm, and load the parser from jsDelivr at the
package's pinned version. For a page without a bundler or its own Monaco, see
the core README's static-site quick start (`/bundled`).

## Running them

The apps install the packages from tarballs of the current build
(`examples/.packs/`), exactly as npm would publish them. From the repo root:

```bash
npm ci && npm run build
npm run install:angular && npm run build:angular
npm run pack:examples       # pack both packages into examples/.packs/
npm run install:examples    # install each app, and the test harness
npm run build:examples      # production builds
npm run test:examples       # smoke tests (Playwright)
```

Then start one with its dev server:

| Script | URL |
|---|---|
| `npm run start:example:vanilla-ts` | http://localhost:5173 |
| `npm run start:example:react` | http://localhost:5174 |
| `npm run start:example:angular` | http://localhost:4200 |

Options after `--` reach the dev server, for example
`npm run start:example:react -- --port 3000`. The dev servers listen on every
address, so a devcontainer's port forwarding reaches them. Inside an app's
folder, `npm run dev` (Angular: `npm start`) does the same.

Don't run a plain `npm install` or `npm ci` in an app after re-packing. The
lockfile pins an older pack's integrity hash, and npm installs that cached
tarball without a warning. `install:examples` installs the packs by path
instead.

CI runs all of this on every PR (the `example-apps` job).
