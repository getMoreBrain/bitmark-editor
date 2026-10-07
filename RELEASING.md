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
