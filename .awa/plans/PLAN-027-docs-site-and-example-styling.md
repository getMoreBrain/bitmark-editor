# PLAN-027: Docs Site and Example Styling

STATUS: in-progress
DIRECTION: lateral
TRACEABILITY: PLAN-024-extract-from-playground.md, PLAN-026-example-apps.md

## Context

The documentation is three long READMEs, and the GitHub Pages site is a
single landing page with two demos and the API reference. The bitmark-parser
project publishes an Eleventy site with a sidebar, search, light and dark
themes and live examples. The editor's docs should be the same kind of site,
in the same visual family. The example apps work but look bare; they should
look finished, without becoming hard to copy from.

## Decisions (agreed 2026-10-07)

- D1 — An Eleventy 3 site in `docs-site/` at the repo root, a member of the
  root npm workspace. It is modelled on the parser's `docs-site/`
  (Nunjucks layouts, Markdown pages, CSS split by concern on design tokens,
  `HtmlBasePlugin` for the `/bitmark-editor/` path prefix). It shares none of
  the parser site's code.
- D2 — English only. No i18n machinery.
- D3 — The site holds the long-form docs. Each package README keeps an
  overview, how to install, one quick start and links to the site's pages
  (npm shows the README). Each topic lives in one place.
- D4 — Search: Pagefind, built after Eleventy, over the guide pages. The API
  reference keeps typedoc's own search.
- D5 — The site replaces the current Pages build: its Try it and injected
  parser demos run on `/bundled` from the same origin, with the parser from
  jsDelivr at the pinned version, and the API reference (typedoc) is served
  at `/api/`. `packages/bitmark-editor/examples/pages/` and its smoke test
  move into the site.
- D6 — Look: the parser site's design tokens (brand indigo `#27187e`, system
  fonts, its spacing scale, AA contrast), the bitmark logo, a header with
  a theme toggle (light, dark, follow the OS) and a sidebar. The CSS is the
  site's own, a few files.
- D7 — Example apps: the same tokens, lightly. A header with the wordmark
  and the theme switcher, panes in labelled cards, and a status line. Each
  app's CSS stays one short, plain file that is easy to copy.

## Steps

### Docs site

- [ ] Scaffold `docs-site/`: `package.json` (Eleventy 3, Pagefind), `eleventy.config.js`, `src/` with `_data/site.js` (name, version from the core's `package.json`, repo URL, the pinned parser version), `_includes/layouts/base.njk` (header, sidebar, main, footer) and `_data/nav.js` (the sidebar)
- [ ] Styles in `src/assets/css/`: `tokens.css` (brand and theme tokens, light and dark), `base.css`, `shell.css` (header, sidebar, layout, responsive), `content.css` (prose, code, tables, callouts, demo frames)
- [ ] Scripts in `src/assets/js/`: `theme.js` (toggle, stored choice, no flash before paint), `nav.js` (mobile sidebar). The demo pages bring their own scripts
- [ ] Pages, from the README content (D3):
  - Home: what it is, a live Try it, install, where to go next
  - Getting started: which build, install, peer dependencies
  - Guides: static site (`/bundled`), host with Monaco (core and `/elements`), React, Angular, custom elements, panes, session, the parser (loaded, injected, worker), theming (themes, CSS variables, matching Monaco), scroll linking, Content Security Policy, sizes
  - Demos: Try it, injected parser, and the example apps (links to their source)
  - Reference: API (typedoc), tested versions, changelog
- [ ] Build: `npm run build:site` builds the core, typedoc into the site's `api/`, `dist/bundled` beside the demos, then Eleventy with `--pathprefix=/bitmark-editor/` and Pagefind. `npm run start:site` runs the dev server (Eleventy `--serve`, listening on every address, as the example apps do)
- [ ] Code samples use Eleventy's syntax highlighting, without client-side JavaScript

### Tests and deploy

- [ ] Site smoke test (Playwright, served under `/bitmark-editor/`): every internal link resolves (the whole site is crawled), Try it works (ready, conversion, completion, the JSON schema), the injected-parser demo works, a search finds a guide page, and the theme toggle switches and remembers
- [ ] `pages.yml` deploys the site; CI's `core` job builds it and runs the smoke test. Remove `packages/bitmark-editor/examples/pages/` and `tests/pages.spec.mjs`, and the root `build:pages` / `test:pages` scripts become the site's

### READMEs

- [ ] Core README: overview, install, which build, the host quick start, links to the site's guides and API
- [ ] Angular library README: the same shape
- [ ] Root README: links to the site first

### Example apps

- [ ] A shared look in each app's CSS: tokens (light and dark), header (wordmark, theme switcher), panes as labelled cards, status line. The markup changes only where the labels need it
- [ ] Smoke tests still pass, including the theme and contrast checks

## Risks

- The site's internal links and the API reference move together under one prefix. The link-crawl test covers broken links.
- Moving README content to the site loses it on npm. Mitigation: the README keeps install and the quick start, and links to each guide.
- The Pages build grows (Eleventy, Pagefind). It stays a few seconds. Pagefind is a binary npm package; check that it installs in the devcontainer (arm64) and in CI.

## Dependencies

- PR #5 (this branch is stacked on it: it changes the Pages test this plan moves)

## Completion Criteria

- [ ] The site builds, its smoke test passes locally and in CI, and it deploys to https://getmorebrain.github.io/bitmark-editor/
- [ ] Every guide topic lives on the site; the READMEs link to it and keep a quick start
- [ ] The example apps share the site's look and still pass their smoke tests
- [ ] `awa check` passes

## References

- Parser docs site: getMoreBrain/bitmark-parser `docs-site/` (Eleventy config, tokens.css, layouts)
- PLAN: .awa/plans/PLAN-024-extract-from-playground.md (Phase 6, the current Pages build)
- PLAN: .awa/plans/PLAN-026-example-apps.md
