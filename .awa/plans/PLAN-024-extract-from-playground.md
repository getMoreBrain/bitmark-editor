# PLAN-024: Extract bitmark-editor from the Playground

STATUS: in-progress
DIRECTION: lateral
TRACEABILITY: PLAN-022-bitmark-editor-package.md, PLAN-023-bitmark-editor-package-steps.md

## Context

This repo (`git@github.com:getMoreBrain/bitmark-editor.git`) began as a copy of
`bitmark-playground`. The plan there was for `@gmb/bitmark-editor` and
`@gmb/bitmark-editor-angular` to move to their own repository unchanged and be
published from it (PLAN-022 D6). This plan removes the Playground app and its
history, makes the root a private npm workspace for the two packages, moves
the repo from Bun to npm, and prepares both packages for publishing to npm.

## Decisions (agreed 2026-10-06)

- D1 — Layout: the root becomes a private workspace (`@gmb/bitmark-editor-workspace`).
  The packages stay where they are, at `packages/bitmark-editor` and
  `packages/bitmark-editor-angular`.
- D2 — Publishing: a GitHub workflow publishes both packages to npm when a
  `vX.Y.Z` tag is pushed. It authenticates with npm trusted publishing
  (OIDC), not a stored `NPM_TOKEN`: classic npm tokens are gone, and granular
  write tokens expire. Neither name exists on npm yet, and a trusted publisher
  can only be configured on an existing package, so the first version is
  published by hand (Phase 7). Both packages share one version (lockstep).
- D3 — History: delete Playground plans PLAN-001…021 and the throwaway spikes
  (`spikes/`, `playground-spike/`). Keep PLAN-022/023 as the package's origin.
  The Playground repo's history keeps the rest. This repo has no commits yet:
  see Phase 0.
- D4 — GitHub Pages: replace the Playground deploy with the package's static
  examples plus the typedoc API docs.
- D5 — Package manager: npm everywhere, not Bun. Bun was chosen for the
  Playground app (PLAN-001). The packages use it only to install and run
  scripts: tests run on Vitest under Node, the build is a Node script with
  esbuild, the Angular side already uses npm, and publishing uses
  `npm publish --provenance`. With npm there is one tool in CI and the
  devcontainer, and contributors can run plain `npm install`.
  - The root npm workspace holds `packages/bitmark-editor` and
    `packages/bitmark-editor/examples`, with one root `package-lock.json`.
  - `packages/bitmark-editor-angular` stays a standalone npm project with its
    own `package-lock.json` and `file:../bitmark-editor`. It pins Monaco 0.46
    and TypeScript 5.9 to match cosmic, and `angular.json` copies assets from its
    own `node_modules`. Hoisting from a shared workspace would break both.
- D6 — Git history starts in this repo with a snapshot commit of the copy
  (Phase 0). The Playground's history is not imported. The repo is public,
  and both packages are open source under ISC.
- D7 — Once `0.1.0` is published, the Playground uses `@gmb/bitmark-editor`
  from npm and deletes its `packages/` copy. That work happens in the
  Playground repo. This repo's part: publish a version the Playground can use,
  and keep the hand-off notes current.

## Inventory

### Remove (Playground only)

- App source: `src/` (components, services, state, theme, scrollSync, session,
  utils, logging, generated, test mocks, `App.*`, `index.*`, `monaco-setup.ts`, `logo.svg`)
- App shell: `index.html`, `public/`, `vite.config.ts`, `config-overrides.js`
  (a CRA leftover), `scripts/generate-build-info.js`
- Playground fixtures: `test/fixtures/` (the package has its own, `packages/bitmark-editor/test/fixtures`)
- Bun lockfiles: the root `bun.lock` and `packages/bitmark-editor/examples/bun.lock` (D5). The root `package-lock.json` belongs to the app: delete it and regenerate it in Phase 2
- Workflow `.github/workflows/build-and-deploy-to-github-pages.yml`: replaced in Phase 6
- Spikes: `packages/bitmark-editor/spikes/`, `packages/bitmark-editor/playground-spike/`
- Plans: `.awa/plans/PLAN-001` … `PLAN-021`

### Keep

- `packages/bitmark-editor/` (src, test, examples, docs, scripts, configs)
- `packages/bitmark-editor-angular/` (library and its `example` project, e2e)
- Tooling: `.awa/`, `.awa.toml`, `.claude/`, `.github/{agents,prompts,skills,ISSUE_TEMPLATE}`,
  `.devcontainer/`, `.vscode/`, `.mise.toml`, `.playwright/`, prettier/eslint configs, `LICENSE`, `CLAUDE.md`

## Steps

### Phase 0 — Baseline and cut-over

- [x] Record the Playground commit this copy was taken from, and diff `packages/` against the Playground's current `main`. Port any later package commits before continuing — `bitmark-playground@8297e94` (main, PR #9). `packages/` is identical, so there is nothing to port
- [x] First commit: the copy as it is, "Import from bitmark-playground@8297e94". Do the extraction on a branch (`chore/extract`) as a PR, so the deletions can be reviewed and the CI changes run before they reach `main`
- [x] Freeze package changes in the Playground repo: from now on `@gmb/bitmark-editor` changes land here. Add a note to the Playground's `packages/bitmark-editor/README.md` (Playground follow-up) — branch `chore/bitmark-editor-moved` in `bitmark-playground`, with a "Moved" note in the root README and both package READMEs. Its PR still has to be opened and merged (by hand: no `gh` here)

### Phase 1 — Remove the Playground app

- [x] Delete the app source, the app shell, `test/fixtures/`, both `bun.lock` files and the root `package-lock.json` (see Inventory). The app's build output (`build/`, `bundle-stats.html`) is gone too
- [x] Delete `packages/bitmark-editor/spikes/` and `packages/bitmark-editor/playground-spike/`
- [x] Delete `.awa/plans/PLAN-001` … `PLAN-021`
- [x] Drop `spikes` and `playground-spike` from the ignores in `packages/bitmark-editor/eslint.config.mjs`; drop the spike entries from `.gitignore`
- [x] Remove the parts of the README "Development" section that mention `spikes/`, `playground-spike/` and the playground path alias (`packages/bitmark-editor/README.md`)

### Phase 2 — Root becomes a private workspace

- [x] Rewrite the root `package.json`:
  - name `@gmb/bitmark-editor-workspace`, `"private": true`, no version or deps used by the app
  - `workspaces`: `packages/bitmark-editor`, `packages/bitmark-editor/examples` (D5)
  - scripts that delegate with `npm run <script> -w <workspace>`: `build`, `test`, `lint`, `typecheck`, `docs`, `examples:test`. Angular scripts: `angular:install` (`npm ci --prefix`), `angular:build` and `angular:test` (`cd` into the Angular project, so `ng` and Playwright resolve their configs as in CI)
  - devDependencies: only the shared tooling (eslint, the markdown plugin, prettier, `@ncoderz/awa`, so that `npx awa` works). No TypeScript: nothing at the root is TypeScript any more
  - Prettier pinned exactly (`3.9.9`) at the root and in the core: a fresh resolution picked up 3.9.9, which reformats one union in `src/engine/latest.ts` (applied)
  - remove `preinstall: npx only-allow bun`; add `"packageManager": "npm@11.13.0"` (an exact version, as in the Angular workspace; a range is not valid there) and `engines.node >=22` (Node 20 reached end of life in April 2026)
- [x] Root `tsconfig.json`: remove the app `paths`/`include`. Either delete it, or keep a solution-style file that references the package `tsconfig`s — deleted
- [x] Root `eslint.config.mjs`: lint repo-level files only and leave package source to the package's own config, or delete it if nothing is left to lint — kept for the root `.js`/`.mjs` and Markdown files; the TypeScript block is gone, and `.claude` (vendored skills) is ignored like `.github` and `.awa`
- [x] Root `.prettierignore`/`.gitignore`: remove `build/`, `bundle-stats.html`, `/vscode-case-study` and the app's other entries; add the Angular `e2e/results` (`/packages/*/dist/*` already covers the Angular dist) — the Angular project's own `.gitignore` already ignores `e2e/results`
- [x] `npm install` from clean; commit the new root `package-lock.json`. Check that `examples` resolves `@gmb/bitmark-editor` and its own `@playwright/test`/`esbuild` from the workspace — checked: lint, typecheck, 181 unit tests, build, the 7 examples browser checks, and the Angular build and e2e all pass
- [x] `.devcontainer/`, `.vscode/launch.json`, `.mise.toml`: remove the app-specific items (port 3010 launch config, the app's start task) — none were left
- [x] Remove Bun from the tooling (D5):
  - `.mise.toml`: remove `bun`; keep `node`. Add a `.nvmrc` with the same Node version, so `setup-node` (`node-version-file: .nvmrc`) and mise agree
  - `.devcontainer/scripts/post-create.sh`: `mise exec -- bun install` → `npm ci`, then `npm run angular:install`
  - `.vscode/settings.json` / `launch.json`: any Bun runtime or task → npm

### Phase 3 — Repository metadata in both packages

- [x] `packages/bitmark-editor/package.json`: `repository.url` → `git+https://github.com/getMoreBrain/bitmark-editor.git` (keep `directory`); `homepage` → the new repo README or the Pages site; add `bugs`
- [x] `packages/bitmark-editor-angular/projects/bitmark-editor-angular/package.json`: the same changes, plus a `homepage`. Its `repository.directory` now points at the library folder (`…/projects/bitmark-editor-angular`), not the Angular workspace
- [x] Check that `license` (ISC, D6) matches the root `LICENSE` and the package `LICENSE` files. Copy the root copyright line (`©2026 Get More Brain Ltd`, already updated) to `packages/bitmark-editor/LICENSE` and the Angular library's `LICENSE`. Add `LICENSE`/`README.md` to the Angular library's ng-packagr `assets` if missing — not needed: ng-packagr copies them itself
- [x] Check `files`, `exports`, `sideEffects`, `engines` and `peerDependencies`. For each package, `npm pack --dry-run` should list only `dist`, the README, the CHANGELOG and the LICENSE — core: 71 files, 1.6 MB packed (5.8 MB unpacked, mostly `/bundled` Monaco); Angular: 7 files
- [x] Core `engines.node`: `>=20` → `>=22` (Node 20 is end of life). It is a browser library, so this only affects tooling that installs it
- [x] Run `publint` and `@arethetypeswrong/cli` (`attw --pack --profile esm-only`) on both packages, and fix what they report. Both are clean now (attw exits 0; the remaining rows are the ignored node10 and CommonJS ones). publint found nothing, and the `default` condition was not needed. attw found:
  - core: the emitted `.d.ts` used extensionless relative imports (`./editor`), so the types broke under `moduleResolution: node16`/`nodenext`. Fixed in the source: all 218 relative specifiers in 54 files now carry `.js` or `/index.js`. The core `tsconfig.json` is now `module`/`moduleResolution: NodeNext`, so `typecheck` rejects a new extensionless import (TS2835). The build (esbuild) is unchanged
  - core: `./worker` had no `types`. It now points at `dist/types/engine/worker/engineWorker.d.ts`
  - Angular: clean apart from CommonJS, which doesn't apply
- [x] Angular: confirm the README and LICENSE end up in `dist/bitmark-editor-angular`. ng-packagr's `assets` lists only the CHANGELOG — both are there
- [x] Published READMEs: links that leave the package break on npmjs.com. The Angular README linked `../../../bitmark-editor/README.md`; it now links the npm page

### Phase 4 — Remove Playground wording from the package

- [x] `packages/bitmark-editor/README.md`: remove "bitmark playground repo"; link design notes to `.awa/plans/PLAN-022/023` in this repo; change the Development commands from `bun run …`/`bun install` to npm (D5)
- [x] `packages/bitmark-editor-angular/README.md`: `bun run build` → `npm run build`. It also says the project is outside the root workspace, and names the root `angular:*` scripts
- [x] Source comments that call the Playground the reference host (`src/elements/elements.ts`, `src/monaco/jsonSchema.ts`, `src/monaco/setup.ts`, `src/theme/tokens.ts`, `src/editor/textEditor.ts`, `src/session/types.ts`): reword them to describe the behaviour ("the full arrangement", "a host that…"), without changing code
- [x] `src/monaco/helpers.test.ts`: change the `/bitmark-playground/local-engine/...` URL fixtures to a neutral path (the test is about URL shape, not the Playground) — now `/app/local-engine/...`
- [x] `docs/handoff-*.md` and `docs/upstream-parser-note.md`: update repo links. Keep these docs, since they are hand-offs to consumers — no changes needed: they use repo-relative paths, which are still valid here, and don't name the Playground repo
- [x] Add `docs/handoff-playground.md` (D7): how the Playground moves from the source aliases to the published package. Cover the `/react` adapter, injecting its own Monaco 0.52 and engine, `dedupe`, and what the Playground's tests mock. All 31 names the Playground imports were checked against the public entry points (a typecheck through the package's own `exports`)
- [x] `grep -ri playground` over `packages/` (excluding `node_modules`/`dist`) returns only deliberate mentions (e.g. "used by the bitmark Playground") — two remain: `helpers.test.ts` ("ported from the bitmark Playground's tests") and `docs/handoff-playground.md`. The stale typedoc output in `docs/api` (gitignored) was deleted and rebuilt, so its source links point here

### Phase 5 — CI

- [ ] `.github/workflows/bitmark-editor.yml` → rename to `ci.yml`:
  - drop the root `src` path filter and the step "The playground still compiles and passes on the package source"
  - run on every push or PR to `main` (no path filters, since the whole repo is now the package)
  - keep the core job (lint, typecheck, test, build, examples) and the Angular job (lib build, example build, e2e)
  - add `npm pack --dry-run`, `publint` and `attw` for both packages
  - core job: replace `oven-sh/setup-bun` with `actions/setup-node` (`node-version-file: .nvmrc`, `cache: npm`), `npm ci` at the root, then the root scripts. Examples no longer need their own install step
  - Angular job: `cache: npm` with `cache-dependency-path: packages/bitmark-editor-angular/package-lock.json`
- [ ] `bitmark-editor-parser-bump.yml`: remove `setup-bun`; `bun install` → `npm install` (it updates `package-lock.json`); update the comments; keep `BITMARK_EDITOR_BOT_TOKEN`
- [ ] Remove the README badge for the Playground deploy workflow
- [ ] Add `.github/dependabot.yml` for `github-actions` and `npm` (root and Angular directories), grouped and weekly. Ignore `@gmb/bitmark-parser`, because the parser-bump workflow owns it
- [ ] Branch protection on `main`: require the CI jobs to pass and require PRs. This is a manual step for a repo admin

### Phase 6 — GitHub Pages (examples + API docs)

- [ ] New workflow `pages.yml` that runs on push to `main`: `npm ci`, build the package and `typedoc`, then assemble a site:
  - `/` — a landing page linking to the demos and the API docs
  - `/examples/` — Pages copies of `examples/static/*.html`, with `dist/bundled` beside them. The pages themselves can't be copied as they are: they hard-code `http://localhost:4612/` for the package (`/pkg/`) and the parser (`/parser/`, `engine-url`, `schema`), because `serve.mjs` serves two local origins. The Pages copies leave out `engine-url`/`schema`, so the package loads its pinned parser from jsDelivr (`DEFAULT_PARSER_VERSION`), and load `bundled.js` from the same origin. Either generate the copies in the workflow (a small `scripts/build-pages.mjs`) or make the pages take their URLs from a query or config. Keep `examples/tests` working against `serve.mjs`
  - `/api/` — `docs/api` (typedoc output)
- [ ] Check that the static examples run on a sub-path (`/bitmark-editor/`): worker URLs and the `bundled/*` chunk resolution must not assume the root. Run a Playwright smoke check against the built site, served under that base path, before deploying
- [ ] Enable Pages in the repo settings (source: GitHub Actions). This is a manual step for a repo admin

### Phase 7 — Publish on tag

- [ ] Bootstrap (manual, once, by a member of the `@gmb` npm org with 2FA): publish `0.1.0-rc.0` of both packages from a clean build, using `npm publish --tag next --access public`. Then, on npmjs.com, add a trusted publisher to each package: repo `getMoreBrain/bitmark-editor`, workflow `release.yml`, environment `npm`
- [ ] New workflow `release.yml`, triggered on `v*.*.*` tags (this also matches `v0.2.0-rc.1`):
  - check that the tag matches the `version` in both package.json files, and that the Angular peer range for `@gmb/bitmark-editor` includes it (fail otherwise)
  - build and test as in CI
  - publish job in a GitHub environment `npm` (protected: tag rules or required reviewers), with `permissions: id-token: write, contents: write`. It needs npm 11.5+ for trusted publishing, which Node 24 has
  - dist-tag from the version: a prerelease (`-rc.N`, `-beta.N`) gets `--tag next`, otherwise `--tag latest`. Always pass `--tag`
  - `npm publish --access public --tag <tag>` for `packages/bitmark-editor`, then for `packages/bitmark-editor-angular/dist/bitmark-editor-angular`. Trusted publishing adds provenance automatically, because the repo is public (D6)
  - create a GitHub Release with that version's `CHANGELOG.md` section (core and Angular)
- [ ] Angular peer range: in 0.x, `^0.1.0` means `<0.2.0`, so every minor release updates the Angular `peerDependencies` range for `@gmb/bitmark-editor` along with both versions. The release workflow's check enforces this
- [ ] Root script `npm run release:version -- <version>`: sets both package versions and the Angular peer range together (`npm version --no-git-tag-version -w` plus a small edit). Add a release checklist to the root README: run it, update both CHANGELOGs, commit, tag, push

### Phase 8 — Docs and specs

- [ ] Root `README.md`: rewrite for the repo. It should say what the packages are, link to each package README, the live demo and the API docs, and cover development commands, the release process and the badges (CI, npm)
- [ ] `.awa/specs/ARCHITECTURE.md` (via awa-architecture):
  - purpose: the editor packages, not the Playground
  - remove the UI, State and Build (Vite) layers that belonged to the Playground; Valtio and Theme UI; and the rules that applied only to the app (Valtio setters, `useSnapshot`, build info)
  - technology stack: Bun → npm workspaces (D5); remove Vite
  - directory structure, developer commands (npm), release status ("Alpha — 0.1.0, first publish")
  - change log entry 2.0.0: extracted from the Playground (PLAN-024)
- [ ] `CLAUDE.md`/`.claude/settings.local.json`: remove any Playground-specific instructions or permissions
- [ ] Run `awa check --spec-only` after the plan and spec edits

### Testing

- [ ] From a clean clone: `npm ci`, then the root scripts `lint`, `typecheck`, `test`, `build` all pass
- [ ] `examples` browser checks pass (`npm run examples:test`)
- [ ] Angular: `npm run angular:install`, `ng build bitmark-editor-angular`, `ng build example`, the e2e checks pass
- [ ] `grep -rI bun` (excluding `node_modules`, `dist`, `.awa/plans`) finds no Bun commands; only words like "bundled" remain
- [ ] A rebuilt devcontainer comes up with `npm ci` and no Bun
- [ ] Consumer smoke test: in a scratch Vite app outside the repo, `npm install ./packages/bitmark-editor/<pack>.tgz` with `monaco-editor` and `@gmb/bitmark-parser`. Then `@gmb/bitmark-editor`, `/elements`, `/react` and `/bundled` all import and render
- [ ] CI is green on the extraction PR (Phase 0)
- [ ] Pages smoke check passes against the built site under `/bitmark-editor/`
- [ ] `awa check` passes

## Risks

- Moving from `bun.lock` to `package-lock.json` resolves dependencies afresh, so versions within existing ranges can change. Mitigation: pin anything that the tests show is sensitive (the Monaco 0.57 dev copy and the parser 7.9.0 dev copy are pinned already), and run the full test and browser suite before the first commit.
- `examples` joins the workspace, so its `@playwright/test`/`esbuild` may be hoisted to the root. Its tests resolve `dist/` by relative path, not through `node_modules`, so this should not matter. Mitigation: run the examples' browser checks in Phase 2.
- The Angular project stays outside the workspace (D5). It installs separately and keeps its own lockfile. That is deliberate: the root README and the root `angular:install` script make it a single command.
- Pages sub-path: the `/bundled` build resolves its workers and chunks relative to its own URL. The examples were only checked when served from `/`. Mitigation: a Pages smoke check (Playwright against the built site under a base path).
- npm publishes can't be undone: a version number can never be reused, even after an unpublish. Mitigation: the first publish is `0.1.0-rc.0` under `next`; consume it from an outside app (Testing) before `0.1.0` goes to `latest`. The release workflow runs `npm publish --dry-run` before the real publish.
- Trusted publishing can't be set up before the packages exist, so the bootstrap publish is manual. If it is done from a dirty or wrong build, the bad version stays. Mitigation: publish from a fresh clone, after `npm ci`, the full test run and `npm pack --dry-run`.
- The Angular project links the core with `file:../bitmark-editor`, so the core's dependencies (Monaco 0.57 from the root workspace) resolve from the core's real path, not the Angular `node_modules`. The core imports Monaco as types only, so this is safe today. If that changes, the e2e checks will catch it.
- The devcontainer mounts a `node_modules` volume at the root. Removing the app's dependencies changes the lock, so contributors need to rebuild the container (Bun is removed from mise) or run `npm ci`.

## Dependencies

- PLAN-023 finished (status in-progress: check its remaining items before Phase 7)
- A member of the `@gmb` npm org with publish rights and 2FA, for the bootstrap publish and the trusted-publisher setup
- `BITMARK_EDITOR_BOT_TOKEN` secret recreated in the new repo (parser bump PRs)
- Repo admin: Pages enabled (Actions source), the `npm` environment, branch protection on `main`
- Playground follow-up (other repo, D7): freeze `packages/` there now. After `0.1.0` is published:
  - depend on `@gmb/bitmark-editor@^0.1.0` instead of `workspace:*`
  - remove the source aliases in `vite.config.ts` and `tsconfig.json`
  - delete `packages/` and the bitmark-editor workflows
  - keep `dedupe` for React and Monaco

## Completion Criteria

- [ ] No Playground app files remain. `grep -ri playground` over `packages/`, the root files, `.github/` and `.devcontainer/` finds only deliberate mentions. Kept plans (PLAN-022/023) are historical and are left as they are
- [ ] The root is a private workspace. A clean clone installs, lints, typechecks, tests and builds with root scripts
- [ ] CI, Pages and release workflows exist. CI is green. Pages serves the examples and the API docs
- [ ] `npm pack --dry-run` for both packages contains only the intended files, with the correct repo metadata
- [ ] After the manual bootstrap, a pre-release tag publishes both packages under `next` through trusted publishing, and an outside app consumes them
- [ ] `publint` and `attw` pass for both packages
- [ ] `docs/handoff-playground.md` exists, and the Playground follow-up is raised as an issue in `getMoreBrain/bitmark-playground` (D7)
- [ ] `ARCHITECTURE.md` and the READMEs describe the packages, not the Playground. `awa check` passes

## Open Questions

- [x] Layout? — Private workspace root, the packages stay in `packages/` (D1)
- [x] Publishing? — Tag-triggered workflow to npm (D2)
- [x] Plans 001–021 and spikes? — Delete (D3)
- [x] Pages? — Examples + API docs (D4)
- [x] Bun or npm? — npm (D5)
- [x] Should the Angular workspace join the root workspace? — No, it stays a standalone npm project (D5)
- [x] Should the two packages keep one version (lockstep), or be versioned separately? — Lockstep (D2). The release workflow checks it
- [x] Should `examples/` join the root workspace, or keep its own lock? — It joins (D5)
- [x] License: the package says ISC. Is that the intended license for public npm packages? — Yes, ISC (open source), as in the root and package `LICENSE` files
- [x] Will `getMoreBrain/bitmark-editor` be public? — Yes, so trusted publishing adds provenance and Pages works on the free plan
- [x] Git history: start from a snapshot commit, or keep the package's history from the Playground with `git filter-repo`? — A snapshot commit; history starts here (Phase 0, D6)
- [x] Should the Playground repo then consume the published `@gmb/bitmark-editor` (instead of its in-repo copy)? — Yes (D7). That work is a follow-up in the Playground repo, not this one

## References

- PLAN: .awa/plans/PLAN-022-bitmark-editor-package.md (D6 location, D8 Monaco, D10 Angular, D13 parser pin)
- PLAN: .awa/plans/PLAN-023-bitmark-editor-package-steps.md
- Tooling: .mise.toml, .devcontainer/scripts/post-create.sh, packages/bitmark-editor-angular/angular.json (assets from its own node_modules)
- Code: packages/bitmark-editor/package.json, packages/bitmark-editor-angular/projects/bitmark-editor-angular/package.json
- CI: .github/workflows/bitmark-editor.yml, bitmark-editor-parser-bump.yml, build-and-deploy-to-github-pages.yml
- Architecture: .awa/specs/ARCHITECTURE.md
