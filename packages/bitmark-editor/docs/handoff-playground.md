# Hand-off: the Playground switches to the published package (PLAN-024 D7)

For a branch in `getMoreBrain/bitmark-playground`. The Playground has used
`@gmb/bitmark-editor` from source, through a Bun workspace and path aliases.
Development moved to `getMoreBrain/bitmark-editor` at `bitmark-playground@8297e94`,
and the Playground's `packages/` copy is frozen. Once `0.1.0` is on npm, the
Playground installs it from npm and deletes the copy.

## What the Playground uses

Everything comes from the public entry points; nothing internal (checked
against `0.1.0`'s declarations):

- `@gmb/bitmark-editor`:
  - engine: `createBitmarkEngine`, `loadBitmarkModule`, `throwIfParserError`, `BitmarkEngine`
  - Monaco services: `setupBitmarkMonaco`, `attachBitmarkEditor`, `AttachBitmarkEditorOptions`, `BitmarkEditorServices`, `BITMARK_LANGUAGE_ID`, `MONACO_THEME`, `Monaco`, `CodeEditor`
  - JSON schema: `bindBitmarkJsonSchema`, `loadBitmarkJsonSchema`, `schemaUrlFor`
  - scroll sync: `createScrollSyncGroup`, `ScrollSyncGroup`, `ScrollSyncMember`, `ScrollSyncEditor`, `createSplitBitStarts`, `SplitBitStarts`, `jsonWithBitStarts`, `attachBitMarkers`, `BitMarkers`
  - editing: `createChangeFilter`, `replaceAllKeepingUndo`, `SessionChange`, `BitmarkPane`
- `@gmb/bitmark-editor/react`: `BitmarkSession`, `BitmarkPane`, `useBitmarkSession`

## What to do

1. `package.json`:
   - `"@gmb/bitmark-editor": "workspace:*"` → `"^0.1.0"` (in 0.x a caret range
     takes patches only: `>=0.1.0 <0.2.0`)
   - remove `"workspaces": ["packages/bitmark-editor"]`
   - keep `monaco-editor` (0.52), `react` and `react-dom` as the
     Playground's own dependencies: they are the package's peers, and the
     Playground injects its Monaco (`/esm`, no Monaco inside the package)
   - `@gmb/bitmark-parser` stays a devDependency. The engine still loads
     the parser at runtime from the CDN (`?v2=`) or the local build
     (`?engine=local`)
2. `vite.config.ts`:
   - remove the two `resolve.alias` entries for `@gmb/bitmark-editor` and
     `@gmb/bitmark-editor/react` (source paths), and the same two under
     `test.alias`
   - keep `resolve.dedupe: ['react', 'react-dom', 'monaco-editor']`: one
     React and one Monaco, whatever the package's dev copies were
   - keep the `monaco-editor` → `editor.api` alias and the test mocks for
     Monaco and `react-monaco-editor`. The package imports Monaco as types
     only, so the mocks still cover every runtime Monaco import
3. `tsconfig.json`: remove the `paths` entries for `@gmb/bitmark-editor`,
   `@gmb/bitmark-editor/react`, `react`, `react/*` and `monaco-editor`. They
   only kept the package source on the Playground's copies. Types now come
   from the package's `dist/types`. The Playground's `moduleResolution:
   bundler` resolves them, and so would `nodenext`
4. Delete `packages/bitmark-editor/` and `packages/bitmark-editor-angular/`,
   the workflows `bitmark-editor.yml` and `bitmark-editor-parser-bump.yml`,
   and the README section "The editors as a package". Replace that section
   with a link to the new repo
5. Architecture and plans (`.awa/`): the "Editor Package Layer" becomes an
   external dependency; drop the package directory entries and the
   "lifts out unchanged" constraint

## Checks

- `bun run test`: the Playground's own tests, now on the published package
- `bun start`: hovers, diagnostics, completion with bit templates,
  linked scrolling between the bitmark editor and the right-hand tabs,
  `?engine=local` against a local parser build
- `bun run build`: the bundle has one copy each of React and Monaco
  (`bundle-stats.html`)

## If something is missing

Changes to the package go to `getMoreBrain/bitmark-editor`, not the
Playground's copy. If the Playground needs an export that isn't public,
open an issue there rather than importing from `dist/`.
