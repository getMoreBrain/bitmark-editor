# PLAN-025: Dependency and Tooling Follow-ups

STATUS: in-progress
DIRECTION: bottom-up
TRACEABILITY: PLAN-024-extract-from-playground.md

## Context

The clean npm install in PLAN-024 Phase 2 (2026-10-07) brought up work that
falls outside the extraction: ESLint 9 is no longer supported, two audit
findings, peer ranges that claim versions no test covers, and major versions
of the toolchain. Each section below is independent and is its own PR. Order
them by the priorities given. Leave all of them until PLAN-024 is merged, so
the extraction PR stays reviewable. Once it is merged, Dependabot opens
individual PRs for the root's major updates (it groups only minor and patch
ones). Use those PRs for the steps below, adding the config and code changes
to them, rather than opening parallel branches. The Angular project's majors
are ignored there and stay planned work (Step 4).

Findings as of 2026-10-07 (from `npm outdated` and `npm audit`, root and Angular):

| Area | Now | Latest | Where |
|---|---|---|---|
| ESLint | 9.39.5 (unsupported) | 10.12.0 | root, core |
| `@eslint/js` / `@eslint/markdown` | 9.39 / 7.5 | 10.0 / 8.0 | root, core |
| `eslint-plugin-simple-import-sort` | 12.1 | 14.0 | root, core |
| DOMPurify (inside Monaco 0.57) | 3.4.15 (low) | 3.4.16 | core dev copy, `/bundled` output |
| `@modelcontextprotocol/sdk` (inside `@angular/cli`) | 1.30.0 (high) | fixed after 1.30.1 | Angular dev only |
| Angular | 21.2 | 22.2 | Angular wrapper (peer range already `<23`) |
| React | 18.3 | 19.3 | core dev copy (peer `>=18`) |
| TypeScript | 5.9 | 7.0 | core, Angular |
| Vitest / jsdom / esbuild | 4.1 / 28 / 0.25 | 5.0 / 30 / 0.28 | core, examples, Angular |
| `@types/node` | 20 | 26 | core (`engines.node` is `>=22` since PLAN-024 Phase 3) |

## Steps

### 1. Security (first)

- [x] DOMPurify in `/bundled`: Monaco 0.57.0 pins `dompurify` 3.4.15, and `dist/bundled/monaco.js` ships it. Add a root `overrides` entry, `"dompurify": "3.4.16"`. npm only applies `overrides` at the workspace root. Rebuild, and confirm with `npm ls dompurify` and a grep of `dist/bundled/monaco.js`. Then run the examples' browser checks (hovers and the Markdown that Monaco renders). Remove the override once a Monaco release carries the fix — done differently. An override can't work: Monaco vendors DOMPurify into its ESM build (`esm/vs/base/browser/dompurify/dompurify.js`) and never imports the npm package. A root override also isn't recognised for a workspace member's dependencies (npm installs it, then calls it "invalid"). Instead, the core's build swaps the vendored file for the patched release, a pinned dev dependency (`dompurify` 3.4.16), with an esbuild plugin on the Monaco and worker builds. Checked: `dist/bundled` holds 3.4.16 and no 3.4.15, and the browser checks pass. `npm audit` in the root still lists 3.4.15, because Monaco's `package.json` declares it, but that copy is never bundled. Drop the plugin once a Monaco release vendors a fixed version
- [x] Note in the package README (Monaco section) that `/esm` hosts bring their own Monaco, and with it their own DOMPurify. The advisory reaches hosts only through `/bundled` — the README's "Which build?" section says `/bundled` patches it, and that otherwise Monaco's DOMPurify is the host's to keep current. The example apps keep the stock copy, and their README says so
- [x] Angular dev tooling: `@angular/cli` 21.2.25 pulls `@modelcontextprotocol/sdk` 1.30.0 (GHSA-6qxp-vccf-f47h, OAuth credentials sent to an attacker-chosen server). It is dev only, in the CLI's MCP server, and is not in the published package. Add `overrides` for `@modelcontextprotocol/sdk` in `packages/bitmark-editor-angular/package.json` with the first fixed version, or take the 21.2 patch that ships it. Do not take `npm audit fix --force`, which moves to Angular 22 (see Step 4) — CLI 21.2.25 is the latest 21.x and pins the SDK to exactly 1.30.0, so both Angular projects (the wrapper and `examples/angular`, standalone npm projects where overrides work) override it to 1.32.1. `npm audit` is clean in the wrapper's project, and the library still builds

### 2. ESLint 10

- [x] Root and core: `eslint` ^10, `@eslint/js` ^10, `@eslint/markdown` ^8, `eslint-plugin-simple-import-sort` ^14. `typescript-eslint` 8.71 and `eslint-plugin-prettier` 5.5 already accept ESLint 10
- [x] Read the ESLint 10 migration guide against both configs. The checks: removed rules and options, the `js.configs.recommended` changes, the flat-config defaults (the `files` and `ignores` semantics), and that Node 20 support is dropped (we need `>=22` already) — both configs work unchanged on 10.12. Each file now finds its nearest config, so `eslint .` at the root applies the core's own config inside `packages/bitmark-editor`, which is what the root's ignore intended anyway
- [x] simple-import-sort 13 and 14: check whether the default sort order changed. If so, apply `--fix` in its own commit, so the diff is only the reorder — no reorder was needed, and a test file with unsorted imports still fails
- [x] `@eslint/markdown` 8: check that `language: 'markdown/gfm'` and the recommended rules still apply. Re-check that the `.claude` ignore is still needed — a test file with two H1s and a fence without a language still fails both rules. The `.claude` ignore is still needed: its vendored skill files have 3 errors
- [x] `npm run lint` is clean with `--max-warnings 0`

### 3. Toolchain majors

- [ ] Vitest 5 with jsdom 30 (core): upgrade together, and run the 181 unit tests. Check `vitest.config.ts` for removed options
- [ ] esbuild 0.28 (core build, examples): rebuild and compare `dist/` sizes with the README table (`bundled.js` 13 KB, `monaco.js` 808 KB br). Run the examples' browser checks, including the `/esm` consumer check (`examples/esm/check.mjs`)
- [ ] `@types/node` ^22 in the core, to match `engines.node >=22`
- [ ] TypeScript 7 (the native compiler): first a trial branch. Check `tsc --noEmit`, the declaration emit (`tsconfig.build.json`, `emitDeclarationOnly`), `typedoc` (which needs a version that supports TS 7) and `typescript-eslint` support. If declarations or typedoc are not ready, stay on 5.9 and write down the blocker here. The Angular wrapper stays on the TypeScript that its Angular version supports

### 4. Peer ranges that tests don't cover yet

- [ ] Angular 22: the wrapper's peer range (`>=21.0.0 <23`) already claims 22, but CI builds and tests only 21. Add a CI matrix job that installs Angular 22 in the Angular project (outside its lockfile), then builds the library and the example and runs the e2e test. Keep the library on 21 as its build baseline, so that output built against 21 still works for 21 consumers
- [ ] React 19: the core's peer range (`react >=18`) claims 19, but the dev copy and tests use 18.3. Partly covered since PLAN-026: the React example app runs React 19 and its smoke test passes. The adapter's own unit tests still run on 18 only. Add a test run of the `/react` adapter tests against React 19 (a Vitest project or a CI matrix entry with `react@19`/`react-dom@19`/`@types/react@19`)
- [ ] Monaco: the peer range is `>=0.46.0 <1`. The Angular e2e test covers 0.46 and the examples cover 0.57. Write down that both ends are tested (README, compatibility section)

### 5. Small clean-ups

- [ ] Theme defaults (found in PLAN-026): with no `theme`, the panes use the dark token palette, while a host's Monaco keeps its own theme, light `vs` by default. A host following the quick start gets dark-theme colours on a white editor (bit types at about 2:1 contrast). The README now says to match them. Decide whether the default should change too, for example to warn once when `theme` is unset and `applyMonacoTheme` is false. Changing the default palette to light would only move the mismatch to `vs-dark` hosts
- [ ] Angular wrapper: no `applyMonacoTheme` (found in PLAN-026). Neither `provideBitmarkEditor` nor `bm-session` can pass it, so an Angular host that owns its Monaco has to call `monaco.editor.setTheme` itself (as `examples/angular` does). Add it to `BitmarkEditorConfig` and as a `bm-session` input

- [ ] React adapter sizing (found in PLAN-026): `<BitmarkPane>` sets `height: 100%` on its `<div>`. A host `className` with a border or padding (`content-box`) then makes a grid or flex container grow forever. Set `boxSizing: 'border-box'` in the adapter's default style, with a unit test, and note it in the CHANGELOG

- [ ] `.vscode/settings.json`: remove the leftovers from other projects. That means `pasteImage.*` (pointing at `packages/gatsby/static`), the `jest.*` settings and the Java paths
- [ ] typedoc: `npm run docs` reports 22 warnings, from links between doc pages (e.g. `RawParserModule.convert`). They predate PLAN-024. Fix the TSDoc `{@link}` targets, or set `validation.invalidLink`, and consider `--treatWarningsAsErrors` in CI once it is clean
- [ ] Angular project: pin Prettier exactly as in the root and core (3.9.9), or remove it if nothing in that project uses it
- [ ] `npm outdated` in the root and the Angular project after each step above. Record what is still behind, and why, under Risks

## Risks

- The DOMPurify override replaces Monaco's exact pin. A patch release should be safe, but Monaco's hover and Markdown rendering are the paths to test.
- ESLint 10 plus the plugin majors may reorder imports across many files. Keep that `--fix` diff in its own commit, so review stays easy.
- TypeScript 7 changes the declaration emit. Consumers read `dist/types`, so changes in it are API-visible. Compare `dist/types` before and after with a diff, and run `attw` (PLAN-024 Phase 3).
- An Angular 22 matrix job may fail on the CLI's builder, not on the library. Report such failures separately from library issues.

## Dependencies

- PLAN-024 merged (the npm workspace, CI on npm, `publint`/`attw` in CI)
- Steps 1 and 2 are independent; Steps 3 and 4 benefit from Step 2 landing first (lint rules)

## Completion Criteria

- [ ] `npm audit` is clean in the root and in the Angular project, or each remaining finding is listed here with the reason it is accepted
- [ ] ESLint 10 runs in the root and the core, and lint is clean
- [ ] CI covers both ends of each peer range: Angular 21 and 22, React 18 and 19, Monaco 0.46 and 0.57
- [ ] The toolchain majors are either taken, or deferred with a reason written here

## Open Questions

- [x] Should a scheduled job (like the parser bump) open dependency PRs, or is Dependabot (PLAN-024 Phase 5) enough? — Dependabot is enough. The parser keeps its own workflow, because the default version is also a source constant
- [ ] TypeScript 7: is it worth taking now, or should we wait for typedoc and Angular to support it?

## References

- PLAN: .awa/plans/PLAN-024-extract-from-playground.md (Phase 2 findings, Phase 3 `publint`/`attw`, Phase 5 Dependabot)
- Config: eslint.config.mjs, packages/bitmark-editor/eslint.config.mjs, packages/bitmark-editor/vitest.config.ts
- Advisory: GHSA-6qxp-vccf-f47h (`@modelcontextprotocol/sdk`)
