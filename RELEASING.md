# Releasing

`@gmb/bitmark-editor` and `@gmb/bitmark-editor-angular` are released
together, at one version. Pushing a `v<version>` tag runs
[`release.yml`](.github/workflows/release.yml), which:

1. verifies everything CI does;
2. packs both packages;
3. publishes those tarballs to npm, by trusted publishing (OIDC, with
   provenance);
4. creates the GitHub Release from the CHANGELOGs.

A prerelease (`v0.2.0-rc.1`) goes to the npm dist-tag `next`; anything else
goes to `latest`.

Only repository admins can create `v*` tags (the "release tags" ruleset), and
only `v*` tags can deploy to the `npm` environment that the publish job runs in.

## A release

1. On a branch, set the version everywhere it appears:

   ```bash
   npm run release:version -- 0.2.0
   ```

   This updates:
   - both `package.json` files;
   - the Angular peer range for `@gmb/bitmark-editor` (`^0.2.0`);
   - the CDN URL in the core README;
   - both lockfiles.
2. In both CHANGELOGs, turn `## 0.2.0 (unreleased)` into `## 0.2.0 (<date>)`
   and check the entries. A prerelease uses its base version's section.
3. `npm run release:check -- 0.2.0` passes. Open a PR and merge it.
4. Tag `main` and push the tag:

   ```bash
   git switch main && git pull
   git tag v0.2.0 && git push origin v0.2.0
   ```

5. Watch the Release workflow. Once it is done, check the package pages on
   npm. Each should show the version under the right dist-tag, with
   provenance.

## If a release fails half-way

npm never accepts the same version twice. The publish step skips a package
whose version is already on npm, and the GitHub Release step skips a release
that exists. To finish a release, re-run the failed workflow run; don't
re-tag. If a published version is broken, release a new patch version. Don't
unpublish.

## The first publish (once)

Trusted publishing can only be set up on a package that already exists on
npm. So the first version, `0.1.0-rc.0`, is published by hand, by a member of
the `@gmb` npm org with 2FA:

1. Merge the version change (steps 1 to 3 above, with `0.1.0-rc.0`).
2. From a fresh clone of `main`, build and check:

   ```bash
   npm ci
   npm run build
   npm run angular:install
   npm run angular:build
   npm run release:check -- 0.1.0-rc.0
   npm run pack:check
   npm run angular:pack:check
   ```

3. Publish both packages under `next`:

   ```bash
   npm login
   npm publish packages/bitmark-editor --access public --tag next
   npm publish packages/bitmark-editor-angular/dist/bitmark-editor-angular --access public --tag next
   ```

4. On npmjs.com, for each package, go to Settings → Trusted publishing and
   add a GitHub Actions publisher:
   - organization `getMoreBrain`;
   - repository `bitmark-editor`;
   - workflow `release.yml`;
   - environment `npm`.

   Then set "Publishing access" to require 2FA and disallow tokens. From then
   on, only the workflow can publish.
5. In a PR, update the "not yet published" notes at the top of the root
   README and the core README. For example: "0.1.0-rc.0 is on npm under
   `next`".
6. Tag and push `v0.1.0-rc.0`. The workflow verifies the release, skips both
   packages (they are already on npm) and creates the GitHub Release.
7. Install `@gmb/bitmark-editor@next` in an app outside this repo and check
   it works there. Then release `0.1.0` with the normal steps. That is the
   first publish through trusted publishing.
