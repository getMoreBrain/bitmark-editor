// Site-wide values, read from the core package so they never drift.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const core = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../packages/bitmark-editor',
);
const pkg = JSON.parse(readFileSync(path.join(core, 'package.json'), 'utf8'));
const parserVersion = /DEFAULT_PARSER_VERSION = '([^']+)'/.exec(
  readFileSync(path.join(core, 'src/engine/loadBitmarkEngine.ts'), 'utf8'),
)?.[1];

export default {
  title: 'bitmark editor',
  description: pkg.description,
  version: pkg.version,
  parserVersion,
  repo: 'https://github.com/getMoreBrain/bitmark-editor',
  npm: 'https://www.npmjs.com/package/@gmb/bitmark-editor',
  parserDocs: 'https://getmorebrain.github.io/bitmark-parser/',
  cdn: `https://cdn.jsdelivr.net/npm/@gmb/bitmark-editor@${pkg.version}/dist/bundled/bundled.js`,
};
