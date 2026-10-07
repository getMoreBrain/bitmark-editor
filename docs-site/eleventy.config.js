// The docs site (PLAN-027): Eleventy 3, built for /bitmark-editor/ on
// GitHub Pages, where it is not yet deployed (Pages serves only the API
// reference). Modelled on the bitmark-parser docs site; no shared code.
import { existsSync } from 'node:fs';

import { HtmlBasePlugin, RenderPlugin } from '@11ty/eleventy';
import syntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight';

import nav from './src/_data/nav.js';

/** The sidebar's pages in order, for "Previous" and "Next". */
const sequence = nav.flatMap((section) => section.items).filter((item) => !item.external);

export default function (config) {
  for (const [dir, how] of [
    ['../packages/bitmark-editor/dist/bundled', 'npm run build'],
    ['../packages/bitmark-editor/docs/api', 'npm run build:docs'],
  ]) {
    if (!existsSync(new URL(dir, import.meta.url)))
      throw new Error(`${dir} is missing: run \`${how}\` first`);
  }
  // Production builds pass --pathprefix=/bitmark-editor/; this rewrites every
  // URL in the HTML under it (dev stays unprefixed).
  config.addPlugin(HtmlBasePlugin);
  // Code samples are highlighted at build time: no client-side JavaScript.
  config.addPlugin(syntaxHighlight);
  // Renders the packages' CHANGELOG.md files into the changelog page.
  config.addPlugin(RenderPlugin);

  config.addPassthroughCopy('src/assets');
  // The editor build (for the live demos) and the API reference, from the
  // core package. Build them first: npm run build && npm run build:docs.
  config.addPassthroughCopy({ '../packages/bitmark-editor/dist/bundled': 'bundled' });
  config.addPassthroughCopy({ '../packages/bitmark-editor/docs/api': 'api' });
  config.addFilter('neighbours', (url) => {
    const i = sequence.findIndex((item) => item.url === url);
    return i === -1 ? {} : { previous: sequence[i - 1], next: sequence[i + 1] };
  });

  // Listen on every address, so a devcontainer's port forwarding reaches it.
  config.setServerOptions({ port: 8080, showAllHosts: true });

  return {
    dir: { input: 'src', includes: '_includes', data: '_data', output: '_site' },
    markdownTemplateEngine: 'njk',
    templateFormats: ['njk', 'md'],
  };
}
