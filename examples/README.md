# Example apps

Three small apps that use the packages as an outside host would. Start from
the one that matches your app.

| App | Shows |
|---|---|
| [`vanilla-ts`](vanilla-ts/) | Plain TypeScript on Vite: `createBitmarkSession` and panes, with your own Monaco. |
| [`react`](react/) | React 19 on Vite: `<BitmarkSession>` and `<BitmarkPane>`, with the document in state. |
| [`angular`](angular/) | A zoneless Angular 21 app: `provideBitmarkEditor`, and `bm-session` as a form control. Monaco loads on first use. |

All three have a theme switcher (Auto, Light, Dark) that keeps the bitmark
token colours and Monaco's own theme together. All three use Monaco 0.57 from
npm, and load the parser from jsDelivr at the package's pinned version. For a
page without a bundler or its own Monaco, see the core README's static-site
quick start (`/bundled`).

Monaco 0.57 vendors DOMPurify 3.4.15, which has a low-severity advisory.
`/bundled` patches its copy. These apps show a host's own Monaco as it comes,
so they keep the stock copy until a Monaco release updates it.

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

The apps run the packs as last installed, not the library's source. The
start scripts warn when an app's install is older than the source; then run
`npm run build`, `npm run build:angular`, `npm run pack:examples` and
`npm run install:examples` again.

Don't run a plain `npm install` or `npm ci` in an app. The lockfile holds the
integrity hash of whichever pack it was written with, and every build changes
it. So npm either fails (`EINTEGRITY`, on a clean machine) or installs an
older pack from its cache without a warning. `install:examples` leaves the
packs' hashes out for its `npm ci`, then installs the packs by path.

CI runs all of this on every PR (the `example-apps` job).
