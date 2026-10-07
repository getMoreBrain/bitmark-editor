# PLAN-026: Example Consumer Apps

STATUS: in-progress
DIRECTION: bottom-up
TRACEABILITY: PLAN-024-extract-from-playground.md, PLAN-025-dependency-follow-ups.md

## Context

Three small apps that use the packages as an outside host would: a plain
TypeScript app, a React app and an Angular app. They are the copy-paste
starting point for hosts, and CI builds and drives them against what npm
would publish, so packaging mistakes show up before a release.

The package's own `packages/bitmark-editor/examples/` stay: they test the
static-site and `/esm` paths against the build output. The Angular project's
cosmic-shaped example stays too: it covers Angular with zones, Monaco 0.46
AMD and an injected parser.

## Decisions (agreed 2026-10-07)

- D1 — Location: `examples/vanilla-ts`, `examples/react`, `examples/angular`
  at the repo root. They are private apps, outside the root npm workspace,
  each with its own `package.json`, so each installs like an outside app.
- D2 — Dependencies: the apps install the packed tarballs (`npm pack`) of the
  current build: `file:../.packs/<package>.tgz`. After the first publish,
  their `package.json` files can name the npm versions instead. CI keeps
  testing the tarballs.
- D3 — Plain TypeScript: a Vite vanilla-ts app on the core (`/esm`), with
  Monaco 0.57 injected and its workers set up the usual Vite way.
- D4 — Angular: modern defaults, the opposite of the cosmic example. That
  means a fresh `ng new` app: standalone components, zoneless, Monaco 0.57
  from npm as ESM, and the parser loaded by the package.
- D5 — React: a Vite React app on `/react`, with Monaco 0.57 injected. It
  runs React 19, so it also covers the top of the React peer range (PLAN-025
  Step 4).

## Steps

### Scaffold

- [x] `examples/.packs/` (gitignored): a root script `pack:examples` packs
  the core and the built Angular library there, under fixed names
  (`gmb-bitmark-editor.tgz`, `gmb-bitmark-editor-angular.tgz`), so the
  apps' `file:` dependencies don't change with the version
- [x] `examples/vanilla-ts`: Vite, TypeScript, `monaco-editor` 0.57,
  `@gmb/bitmark-editor`. One page: a bitmark pane, a JSON pane and an HTML
  pane, plus a line showing the latest change. As built, Vite 8 and TypeScript 5.9, with Monaco's workers through `?worker`. Monaco 0.57's worker subpaths are `monaco-editor/editor/editor.worker` and so on; the full import needs the `html` worker as well
- [x] `examples/react`: Vite with `@vitejs/plugin-react`, React 19,
  `monaco-editor` 0.57, `@gmb/bitmark-editor`. The same page through
  `<BitmarkSession>` / `<BitmarkPane>`. The document lives in React state and is passed back as `value`, under StrictMode. Found: `<BitmarkPane>` sets `height: 100%` on its `<div>`, so a border with `content-box` makes a grid row grow forever (a resize loop, 2px per frame). The apps use a `box-sizing: border-box` reset, and the React README warns about it. Hardening the adapter is in PLAN-025
- [x] `examples/angular`: `ng new` (Angular 21, standalone, zoneless, no
  SSR, no routing). Depends on `@gmb/bitmark-editor` and
  `@gmb/bitmark-editor-angular`, with `provideBitmarkEditor` and
  `bm-session` / `bm-pane` bound to a form control. Monaco 0.57 as ESM if
  the Angular builder handles its CSS and workers. If not, it falls back to
  Monaco from `/bundled`, with its files copied by an `angular.json` asset
  entry; record which one was used — Monaco 0.57 as ESM worked. It loads on first use through `provideBitmarkEditor({ monaco: () => import('./monaco') … })`, so the initial bundle is 53 kB. The workers use `new Worker(new URL(…))`, and Monaco's icon font needs `"loader": { ".ttf": "file" }` in `angular.json`. The scaffold's router, test config, Prettier and `.vscode` were removed
- [x] Each app has a short README: what it shows, how to run it, and the
  one or two lines that matter (the Monaco worker setup, the provider). There is also an overview, `examples/README.md`
- [x] Lockfiles: commit each app's `package-lock.json` if npm accepts a
  rebuilt tarball against it (its integrity hash changes with every pack).
  Otherwise ignore them, and say so in the README — tested with a pack whose
  content had changed. Both `npm ci` and `npm install` installed the old
  tarball from npm's cache, matched by the lockfile's hash, with no warning.
  Without a lockfile, or with the pack named on the command line, npm
  installs the new one. So the lockfiles are committed (Vite, React, Angular
  and Monaco stay reproducible), and `install:examples` runs `npm ci`
  then `npm install --no-save ../.packs/…`. The README warns against a plain
  install in an app

### Tests

- [x] `examples/package.json` (private): the test harness, with Playwright
  pinned to the repo's version (1.63.0) and one config with a project per
  app. Each project serves the app's production build — through `examples/serve-static.mjs`, on ports 4701 to 4703
- [x] One smoke test per app: the page loads with no errors; the session is
  ready; bitmark is highlighted; a typed edit reaches the JSON pane (and,
  in Angular, the form control's value) — `examples/tests/app.spec.mjs`, run once per project. The Angular check compares the form value before and after the edit
- [x] Root scripts: `pack:examples`, `install:examples`,
  `build:examples`, `test:examples` — all in `scripts/example-apps.mjs`

### Double-check (2026-10-07)

- [x] Root script names: they mixed target-first (`angular:build`) and verb-first (`lint:fix`), and "examples" meant two things. They are now verb-first, so related scripts group together:
  - `build`, `build:angular`, `build:docs` (was `docs`), `build:pages`, `build:examples`
  - `test`, `test:browser` (the core's browser checks, was `examples:test`), `test:pages`, `test:angular`, `test:examples`
  - `check:package`, `check:package:angular`, `install:angular`, `install:examples`, `pack:examples`
  - unchanged: `typecheck`, `lint`, `release:version`, `release:check`

  Live docs and workflows use the new names; the completed PLAN-024/025 keep the old ones as history. `lint:fix` now also fixes the core, as `lint` checks it
- [x] Start scripts: `start:example:vanilla-ts` (5173), `start:example:react` (5174), `start:example:angular` (4200). Each ends with `--`, so options reach the dev server. Without it, `npm run start:example:react -- --port 3000` gave npm the `--port` and gave Vite `3000` as its root folder
- [x] Stale install warning: each start script first runs `node scripts/example-apps.mjs check <app>`, which warns (and still starts) when the library's source is newer than the app's pack or its install (a stamp written by `install:examples`). A stale Angular install had failed with NG8002 on `bm-pane`'s new `editorOptions` input
- [x] Dev servers in the devcontainer: Vite and `ng serve` listened on `localhost`, which resolved to IPv6 `::1` only. Port forwarding connects over IPv4, so every app hung in the browser (reported by the user). Each app now listens on every address: Vite `server.host: true`, Angular serve `"host": "0.0.0.0"`. Checked: reachable on `127.0.0.1`, and the smoke test passes against all three dev servers
- [x] Reset is in all three apps and in the smoke test: it covers the app-to-session direction (`setBitmark`, React's `value`, Angular's `writeValue`)
- [x] The release's verify job runs the example apps as well, so "verifies everything CI does" stays true
- [x] Root lint ignores the `.angular` and `test-results` folders. The Angular dev server's cache, which includes Monaco, had made lint run for minutes
- [x] `packageManager: npm@11.13.0` in every app and the harness, as in the root

### Themes (2026-10-07)

- [x] Hard-to-read text (reported by the user): the bitmark token colours defaulted to the dark palette, while each app's Monaco kept its light `vs` theme, giving bit types at about 2:1 contrast on white. Measured, then fixed. Each app now has a theme switcher (Auto, Light, Dark) that sets both:
  - plain TS: `theme` with `applyMonacoTheme: true`, and `session.setTheme()`;
  - React: `theme` and `applyMonacoTheme` props;
  - Angular: `[theme]`, plus `monaco.editor.setTheme` from the app, because the wrapper can't pass `applyMonacoTheme` (PLAN-025).

  The page follows the theme too, through `color-scheme`. The core README's quick start now says to match `theme` to the host's Monaco. The package defaults are a PLAN-025 decision
- [x] The smoke test checks the themes: Auto with the OS on light, then dark (emulated live), Dark, then Light. In each, the pane's palette and Monaco's theme match, and a bit type has at least 3:1 contrast on the editor background
- [x] Found by that check: the Angular app never loaded Monaco's CSS (Angular's builder emits the CSS that lazily loaded code imports, but doesn't attach it), so its editors were unstyled. `angular.json` now builds Monaco's prebuilt stylesheet as `monaco.css` (`inject: false`), and `loadMonaco()` attaches it before the first editor. The initial bundle stays at 55 kB; putting the stylesheet in the global styles had pushed it over the 500 kB budget. Checked in both the production build and the dev server

### First run on main (2026-10-07)

- [x] `example-apps` failed on `main`: `npm ci` gave `EINTEGRITY`. The committed lockfile's hash for a pack is never the current pack's. Locally the npm cache had hidden this by quietly serving the old pack, and on the PR runs the job was skipped, because `core` had failed first. Fix in `scripts/example-apps.mjs`: `npm ci` runs with the packs' integrity hashes removed from the lockfile (restored after), then the packs are installed by path with `--no-save`. Checked both ways with a changed pack, via a probe line in the build: with an empty npm cache (as in CI: no `EINTEGRITY`) and with a warm one (no stale pack). In both cases all three apps got the current pack, and the lockfiles were left unchanged

### Sticky scroll (2026-10-07)

- [x] Monaco's sticky scroll (nested scopes pinned at the top) is off in the example apps' JSON and HTML panes, at the user's request: `editorOptions: { stickyScroll: { enabled: false } }`. The Angular wrapper's `bm-pane` had no `editorOptions` input, unlike the core and React, so it gained one, merged over the wrapper's own overflow-widget defaults (the host's options win). The smoke test scrolls the JSON pane into its nested objects and expects no sticky lines. It failed against builds made before the change, and passes after

### CI and upkeep

- [x] `ci.yml`: a job `example-apps`, after `core` and `angular`. It
  downloads both dists, packs them, installs and builds the three apps, and
  runs the smoke tests. Add it to the `main` ruleset's required checks — the job is added. The required check waits until this branch is merged: PR #1 has no such job, so requiring it now would block PR #1
- [ ] After merge: add `example-apps` to the `main` ruleset's required checks (`gh api` on ruleset 24618038)
- [x] `dependabot.yml`: the three apps' directories, grouped and monthly, with
  the same Monaco and Angular-major ignores as the Angular project — with one change: the apps do not ignore Monaco, because they are meant to track the newest one. `@gmb/*` is ignored; the packs replace it
- [x] The root README lists the apps under the packages, and
  `ARCHITECTURE.md` gets them in its directory structure and its
  Build, Test and Release responsibilities

## Risks

- The Angular application builder and Monaco's ESM build: Monaco imports its
  CSS from JavaScript and needs worker entry points. If the builder can't
  take both, the Angular app uses `/bundled`'s Monaco (D4 fallback).
- `file:` tarball dependencies and lockfiles: a re-packed tarball has a new
  integrity hash, which may break `npm ci` against a committed lockfile.
  This is decided in the Lockfiles step.
- Three more installs and builds in CI add a few minutes, so the job runs
  in parallel with nothing waiting on it except the merge.

## Dependencies

- PLAN-024 merged (or this branch stacked on `chore/extract`)

## Completion Criteria

- [x] The three apps build from the packed tarballs and pass their smoke tests, locally and in CI
- [x] Each app's README shows the minimal setup for its kind of host
- [x] `awa check` passes

## Open Questions

- [ ] After the first publish, switch the apps' `package.json` to the npm versions (with CI overriding them with the tarballs), or keep `file:` tarballs?

## References

- PLAN: .awa/plans/PLAN-024-extract-from-playground.md (D5 workspace layout, Phase 5 CI)
- PLAN: .awa/plans/PLAN-025-dependency-follow-ups.md (Step 4: React 19, Angular 22)
- Core README: packages/bitmark-editor/README.md (host quick start, Monaco workers)
