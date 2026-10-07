# bitmark-editor-angular (workspace)

The Angular CLI workspace for `@gmb/bitmark-editor-angular` (PLAN-023 Step
13a) and its cosmic-shaped example app (Step 15a).

```bash
npm install
npx ng build bitmark-editor-angular   # the library → dist/bitmark-editor-angular
npx ng build example                   # the example app → dist/example
cd e2e && npx playwright test -c playwright.config.mjs
```

The library depends on the core package through `file:../bitmark-editor`;
build that first (`npm run build` at the repo root).

This project is not part of the root npm workspace (it pins its own Monaco
and TypeScript; PLAN-024 D5). From the repo root, `npm run angular:install`,
`npm run angular:build` and `npm run angular:test` run the steps above.
