# Example apps

Three small apps that use the packages as an outside host would. Start from
the one that matches your app.

| App | Shows |
|---|---|
| [`vanilla-ts`](vanilla-ts/) | Plain TypeScript on Vite: `createBitmarkSession` and panes, with your own Monaco. |
| [`react`](react/) | React 19 on Vite: `<BitmarkSession>` and `<BitmarkPane>`, with the document in state. |
| [`angular`](angular/) | A zoneless Angular 21 app: `provideBitmarkEditor`, and `bm-session` as a form control. Monaco loads on first use. |

All three use Monaco 0.57 from npm, and load the parser from jsDelivr at the
package's pinned version. For a page without a bundler or its own Monaco, see
the core README's static-site quick start (`/bundled`).

## Running them

The apps install the packages from tarballs of the current build
(`examples/.packs/`), exactly as npm would publish them. From the repo root:

```bash
npm ci && npm run build
npm run angular:install && npm run angular:build
npm run example-apps:pack       # pack both packages into examples/.packs/
npm run example-apps:install    # install each app, and the test harness
npm run example-apps:build      # production builds
npm run example-apps:test       # smoke tests (Playwright)
```

Then, in an app's folder, `npm run dev` (Angular: `npm start`).

Don't run a plain `npm install` or `npm ci` in an app after re-packing. The
lockfile pins an older pack's integrity hash, and npm installs that cached
tarball without a warning. `example-apps:install` installs the packs by path
instead.

CI runs all of this on every PR (the `example-apps` job).
