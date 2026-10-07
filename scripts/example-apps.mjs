// The example apps (PLAN-026): examples/vanilla-ts, examples/react,
// examples/angular, each installed like an outside app.
//
//   node scripts/example-apps.mjs pack     pack both packages into examples/.packs/
//                                          (needs npm run build and npm run build:angular)
//   node scripts/example-apps.mjs install  install each app and the test harness
//   node scripts/example-apps.mjs build    build each app for production
//   node scripts/example-apps.mjs test     smoke-test the production builds
//
// Install: each pack's integrity hash changes with every build, so the
// committed lockfile's hash is always out of date. With it, `npm ci` fails
// (EINTEGRITY) on a clean machine, and on a machine whose npm cache has an
// older pack it silently installs that one. So install runs `npm ci` with the
// packs' hashes taken out of the lockfile (restored after), then installs
// the packs by path with --no-save, which always reads the current files
// (npm ci alone can still pick a cached pack). Everything else stays pinned
// by the lockfile.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examples = path.join(root, 'examples');
const packs = path.join(examples, '.packs');
const PACKAGES = [
  { dir: 'packages/bitmark-editor', built: 'dist/esm/index.js', file: 'gmb-bitmark-editor.tgz' },
  {
    dir: 'packages/bitmark-editor-angular/dist/bitmark-editor-angular',
    built: 'package.json',
    file: 'gmb-bitmark-editor-angular.tgz',
  },
];
const APPS = [
  { name: 'vanilla-ts', packs: ['gmb-bitmark-editor.tgz'] },
  { name: 'react', packs: ['gmb-bitmark-editor.tgz'] },
  { name: 'angular', packs: ['gmb-bitmark-editor.tgz', 'gmb-bitmark-editor-angular.tgz'] },
];

const run = (args, cwd, encoding) => {
  console.log(`$ (${path.relative(root, cwd) || '.'}) npm ${args.join(' ')}`);
  return execFileSync('npm', args, { cwd, stdio: encoding ? 'pipe' : 'inherit', encoding });
};

/** `npm ci` in `cwd`, with the `file:` tarballs' integrity hashes left out of its lockfile. */
const ciWithCurrentPacks = (cwd) => {
  const lockFile = path.join(cwd, 'package-lock.json');
  const original = readFileSync(lockFile, 'utf8');
  const lock = JSON.parse(original);
  for (const entry of Object.values(lock.packages)) {
    if (entry.resolved?.startsWith('file:')) delete entry.integrity;
  }
  writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
  try {
    run(['ci'], cwd);
  } finally {
    writeFileSync(lockFile, original);
  }
};

const commands = {
  pack: () => {
    rmSync(packs, { recursive: true, force: true });
    mkdirSync(packs, { recursive: true });
    for (const { dir, built, file } of PACKAGES) {
      const cwd = path.join(root, dir);
      if (!existsSync(path.join(cwd, built))) {
        throw new Error(`${dir} is not built: run npm run build and npm run build:angular first`);
      }
      const [{ filename }] = JSON.parse(
        run(['pack', '--json', '--pack-destination', packs], cwd, 'utf8'),
      );
      renameSync(path.join(packs, filename), path.join(packs, file));
    }
  },
  install: () => {
    run(['ci'], examples);
    for (const app of APPS) {
      const cwd = path.join(examples, app.name);
      ciWithCurrentPacks(cwd);
      run(['install', '--no-save', ...app.packs.map((p) => `../.packs/${p}`)], cwd);
    }
  },
  build: () => {
    for (const app of APPS) run(['run', 'build'], path.join(examples, app.name));
  },
  test: () => run(['test'], examples),
};

const command = commands[process.argv[2]];
if (!command) {
  console.error(`usage: node scripts/example-apps.mjs <${Object.keys(commands).join('|')}>`);
  process.exit(2);
}
command();
