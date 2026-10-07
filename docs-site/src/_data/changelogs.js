// The packages' CHANGELOG.md files, without their "# Changelog" title, for
// the changelog page (one source: the files the packages publish).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packages = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../packages');
const read = (file) =>
  readFileSync(path.join(packages, file), 'utf8').replace(/^# Changelog\s*\n/, '');

export default {
  core: read('bitmark-editor/CHANGELOG.md'),
  angular: read('bitmark-editor-angular/projects/bitmark-editor-angular/CHANGELOG.md'),
};
