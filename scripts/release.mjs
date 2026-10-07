// Release helper for the two packages, which share one version (PLAN-024 D2).
//
//   node scripts/release.mjs version <v>  set both versions, the Angular peer
//                                         range (^<v>), the README's CDN URL
//                                         and both lockfiles
//   node scripts/release.mjs check <v>    fail unless all of that matches <v>
//                                         and both CHANGELOGs have its section;
//                                         prints the npm dist-tag (next or latest)
//   node scripts/release.mjs notes <v>    print the GitHub Release notes
//
// A prerelease (0.2.0-rc.1) uses its base version's CHANGELOG section (## 0.2.0).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => path.join(root, p);
const CORE = 'packages/bitmark-editor';
const ANGULAR_WORKSPACE = 'packages/bitmark-editor-angular';
const ANGULAR = `${ANGULAR_WORKSPACE}/projects/bitmark-editor-angular`;
const README = `${CORE}/README.md`;
const CHANGELOGS = {
  '@gmb/bitmark-editor': `${CORE}/CHANGELOG.md`,
  '@gmb/bitmark-editor-angular': `${ANGULAR}/CHANGELOG.md`,
};
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const CDN = /@gmb\/bitmark-editor@\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?\//g;

const [command, raw] = process.argv.slice(2);
const version = raw?.replace(/^v/, '');
if (!['version', 'check', 'notes'].includes(command) || !version || !SEMVER.test(version)) {
  console.error('usage: node scripts/release.mjs <version|check|notes> <x.y.z[-pre]>');
  process.exit(2);
}
const base = version.split('-')[0];
const peer = `^${version}`;

const readJson = (p) => JSON.parse(readFileSync(at(p), 'utf8'));
const writeJson = (p, json) => writeFileSync(at(p), `${JSON.stringify(json, null, 2)}\n`);

// The CHANGELOG section for a version: from its `## <base>` heading to the next `## `.
const section = (file) => {
  const lines = readFileSync(at(file), 'utf8').split('\n');
  const start = lines.findIndex((l) => l === `## ${base}` || l.startsWith(`## ${base} `));
  if (start === -1) return undefined;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .join('\n')
    .trim();
};

if (command === 'version') {
  for (const p of [`${CORE}/package.json`, `${ANGULAR}/package.json`]) {
    const pkg = readJson(p);
    pkg.version = version;
    if (pkg.peerDependencies?.['@gmb/bitmark-editor'])
      pkg.peerDependencies['@gmb/bitmark-editor'] = peer;
    writeJson(p, pkg);
  }
  writeFileSync(
    at(README),
    readFileSync(at(README), 'utf8').replace(CDN, `@gmb/bitmark-editor@${version}/`),
  );
  const quiet = { cwd: root, stdio: 'inherit' };
  execSync('npm install --package-lock-only --ignore-scripts', quiet);
  execSync(`npm install --package-lock-only --ignore-scripts --prefix ${ANGULAR_WORKSPACE}`, quiet);
  console.log(
    `${version}: both packages, the Angular peer range (${peer}), the README and the lockfiles`,
  );
  console.log('Next: update both CHANGELOGs, commit, merge, then tag v' + version);
}

if (command === 'check') {
  const problems = [];
  const core = readJson(`${CORE}/package.json`);
  const angular = readJson(`${ANGULAR}/package.json`);
  if (core.version !== version) problems.push(`${CORE}/package.json is ${core.version}`);
  if (angular.version !== version) problems.push(`${ANGULAR}/package.json is ${angular.version}`);
  const range = angular.peerDependencies?.['@gmb/bitmark-editor'];
  if (range !== peer)
    problems.push(`the Angular peer range for @gmb/bitmark-editor is ${range}, not ${peer}`);
  const urls = readFileSync(at(README), 'utf8').match(CDN) ?? [];
  for (const url of urls)
    if (url !== `@gmb/bitmark-editor@${version}/`) problems.push(`${README} has ${url}`);
  for (const [name, file] of Object.entries(CHANGELOGS))
    if (!section(file)) problems.push(`${file} has no "## ${base}" section (${name})`);
  if (problems.length) {
    console.error(`Not ready to release ${version}:\n- ${problems.join('\n- ')}`);
    console.error(`Run: npm run release:version -- ${version}`);
    process.exit(1);
  }
  console.log(version.includes('-') ? 'next' : 'latest');
}

if (command === 'notes') {
  for (const [name, file] of Object.entries(CHANGELOGS)) {
    const notes = section(file);
    if (notes) console.log(`## ${name}\n\n${notes}\n`);
  }
}
