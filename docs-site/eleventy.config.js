// The docs site (PLAN-027): Eleventy 3, served under /bitmark-editor/ on
// GitHub Pages. Modelled on the bitmark-parser docs site; no shared code.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { HtmlBasePlugin, RenderPlugin } from '@11ty/eleventy';
import syntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight';

import nav from './src/_data/nav.js';
import site from './src/_data/site.js';

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
  // While the guides are hidden (site.js), the API reference's home page (the
  // core README) leaves out its links into them: the README marks them with
  // <!-- docs-site-links --> … <!-- /docs-site-links -->. Build only: the dev
  // server serves the API reference straight from the core package.
  if (!site.guidesPublic) {
    config.on('eleventy.after', ({ dir }) => {
      const file = path.join(dir.output, 'api/index.html');
      const html = readFileSync(file, 'utf8');
      const stripped = html.replace(
        /<!-- docs-site-links[^>]*-->.*?<!-- \/docs-site-links -->/gs,
        '',
      );
      if (stripped === html) throw new Error(`${file}: no docs-site-links markers to strip`);
      writeFileSync(file, stripped);
    });
  }

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
