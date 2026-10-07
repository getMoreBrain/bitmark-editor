// Switch the core's dev copy of React (PLAN-025 Step 4), to test the React
// adapter at either end of its peer range (`react >=18`):
//
//   node scripts/set-react.mjs 18   (CI's react-18 job)
//   node scripts/set-react.mjs 19   (the committed baseline)
//
// npm can't switch React in place in a workspace: the lockfile keeps the old
// copy for @testing-library/react, and two Reacts in one test fail ("Objects
// are not valid as a React child"). So this drops React's lockfile entries
// before reinstalling. Don't commit the result of `18`.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSIONS = {
  18: {
    react: '^18.3.1',
    'react-dom': '^18.3.1',
    '@types/react': '^18.3.28',
    '@types/react-dom': '^18.3.7',
  },
  19: {
    react: '^19.2.0',
    'react-dom': '^19.2.0',
    '@types/react': '^19.2.0',
    '@types/react-dom': '^19.2.0',
  },
};

const versions = VERSIONS[process.argv[2]];
if (!versions) {
  console.error(`usage: node scripts/set-react.mjs <${Object.keys(VERSIONS).join('|')}>`);
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgFile = path.join(root, 'packages/bitmark-editor/package.json');
const lockFile = path.join(root, 'package-lock.json');

const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'));
Object.assign(pkg.devDependencies, versions);
writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);

const lock = JSON.parse(readFileSync(lockFile, 'utf8'));
const react = /(^|\/)node_modules\/(react|react-dom|@types\/react|@types\/react-dom|scheduler)$/;
for (const key of Object.keys(lock.packages)) if (react.test(key)) delete lock.packages[key];
writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);

execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
const installed = JSON.parse(
  readFileSync(path.join(root, 'node_modules/react/package.json'), 'utf8'),
);
console.log(`React ${installed.version}`);
