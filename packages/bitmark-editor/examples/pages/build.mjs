// The GitHub Pages site (PLAN-024 Phase 6), into pages/dist:
//   index.html    the landing page
//   try-it.html   static/index.html, on the CDN parser
//   inject.html   static/inject.html, on the CDN parser
//   bundled/      the package's dist/bundled, same origin
//   api/          the typedoc output (docs/api); a placeholder when it hasn't
//                 been built, unless --require-api (the Pages deploy) makes
//                 that an error
// The static examples are written for serve.mjs's two local origins; each
// rewrite below must match, so an edit to an example fails here, not live.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, '../..');
const out = path.join(here, 'dist');

const { version } = JSON.parse(readFileSync(path.join(pkg, 'package.json'), 'utf8'));
const parserVersion = /DEFAULT_PARSER_VERSION = '([^']+)'/.exec(
  readFileSync(path.join(pkg, 'src/engine/loadBitmarkEngine.ts'), 'utf8'),
)?.[1];
if (!parserVersion) throw new Error('DEFAULT_PARSER_VERSION not found');
const parserUrl = `https://cdn.jsdelivr.net/npm/@gmb/bitmark-parser@${parserVersion}/dist/browser/bitmark-parser.min.js`;

const bundled = path.join(pkg, 'dist/bundled');
if (!existsSync(path.join(bundled, 'bundled.js'))) throw new Error('build the package first (dist/bundled)');

// A plain recursive copy: Node's native cpSync directory copy fails on some
// mounted file systems (EACCES on the devcontainer's workspace share).
const copyDir = (from, to) => {
  mkdirSync(to, { recursive: true });
  for (const e of readdirSync(from, { withFileTypes: true })) {
    const [src, dest] = [path.join(from, e.name), path.join(to, e.name)];
    if (e.isDirectory()) copyDir(src, dest);
    else copyFileSync(src, dest);
  }
};

const rewrite = (file, edits) => {
  let html = readFileSync(path.join(here, '../static', file), 'utf8');
  for (const [from, to] of edits) {
    if (!html.includes(from)) throw new Error(`${file}: expected ${JSON.stringify(from)}`);
    html = html.split(from).join(to);
  }
  if (html.includes('localhost')) throw new Error(`${file}: a localhost URL is left`);
  return html;
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

writeFileSync(path.join(out, 'index.html'), readFileSync(path.join(here, 'index.html'), 'utf8').split('__VERSION__').join(version));
writeFileSync(
  path.join(out, 'try-it.html'),
  rewrite('index.html', [
    // No engine-url or schema: the package loads its pinned parser from jsDelivr, and the schema beside it.
    ['        engine-url="http://localhost:4612/parser/dist/browser/bitmark-parser.min.js"\n', ''],
    ['        schema="http://localhost:4612/parser/schema/bitmark.schema.json"\n', ''],
    ["import('http://localhost:4612/pkg/bundled/bundled.js')", "import('./bundled/bundled.js')"],
  ]),
);
writeFileSync(
  path.join(out, 'inject.html'),
  rewrite('inject.html', [
    ["await import('http://localhost:4612/parser/dist/browser/bitmark-parser.min.js')", `await import('${parserUrl}')`],
    ["await import('http://localhost:4612/pkg/bundled/bundled.js')", "await import('./bundled/bundled.js')"],
  ]),
);
copyDir(bundled, path.join(out, 'bundled'));
const api = path.join(pkg, 'docs/api');
if (existsSync(api)) copyDir(api, path.join(out, 'api'));
else if (process.argv.includes('--require-api')) throw new Error('docs/api not built: run `npm run build:docs` first');
else {
  console.warn('docs/api not built: the site gets a placeholder API page (run `npm run build:docs` for the real one)');
  mkdirSync(path.join(out, 'api'), { recursive: true });
  writeFileSync(
    path.join(out, 'api/index.html'),
    '<!doctype html><meta charset="utf-8"><title>API reference</title><p>Not built here: run <code>npm run build:docs</code>.</p>\n',
  );
}

console.log(`pages/dist: @gmb/bitmark-editor ${version}, parser ${parserVersion}${existsSync(api) ? ', API docs' : ''}`);
