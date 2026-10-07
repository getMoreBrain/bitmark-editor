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

// The guides aren't public yet: the site's root redirects to the API
// reference, the overview moves to /overview/, and every guide page asks
// search engines not to index it. Set to true to publish them.
const guidesPublic = false;

export default {
  title: 'bitmark editor',
  guidesPublic,
  /** The overview's URL: the root once the guides are public. */
  home: guidesPublic ? '/' : '/overview/',
  description: pkg.description,
  version: pkg.version,
  parserVersion,
  repo: 'https://github.com/getMoreBrain/bitmark-editor',
  npm: 'https://www.npmjs.com/package/@gmb/bitmark-editor',
  parserDocs: 'https://getmorebrain.github.io/bitmark-parser/',
  cdn: `https://cdn.jsdelivr.net/npm/@gmb/bitmark-editor@${pkg.version}/dist/bundled/bundled.js`,
};
