import js from '@eslint/js';
// import json from '@eslint/json';
import markdown from '@eslint/markdown';
import prettier from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
// import fs from 'fs-extra';
// import stringify from 'safe-stable-stringify';

/** @type {import("eslint").Linter.Config[]} */
const config = [
  //
  // General ESLint configuration
  //
  {
    ignores: [
      '**/package-lock.json',
      '**/node_modules',
      '**/dist',
      '**/docs',
      '**/coverage',
      // Build caches and test output (the Angular dev server caches Monaco here).
      '**/.angular',
      '**/test-results',
      // The docs site's build output (it holds Monaco and the API reference).
      'docs-site/_site',
      '.github',
      '.awa',
      '.claude',
      // The core lints itself (its own eslint.config.mjs, PLAN-022 D6); the
      // Angular workspace is checked by its own build.
      'packages/bitmark-editor',
      'packages/bitmark-editor-angular',
    ],
  },

  //
  // JavaScript files
  //
  {
    files: ['**/*.js', '**/*.mjs'],
    ...js.configs.recommended,
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
      },
    },
  },
  {
    // Run on Node: repo scripts, the example apps' and the docs site's
    // tooling, and the site's data files.
    files: [
      'scripts/**/*.mjs',
      'examples/*.mjs',
      'docs-site/*.{js,mjs}',
      'docs-site/src/_data/**/*.js',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // Run in the browser: the docs site's scripts.
    files: ['docs-site/src/assets/js/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Playwright tests: Node, plus the browser code they pass to page.evaluate.
    files: ['examples/tests/**/*.mjs', 'docs-site/tests/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    plugins: {
      prettier,
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'prettier/prettier': 'error',
      //
    },
  },

  //
  // JSON files - NOT WORKING?
  //
  // {
  //   files: ['**/*.json'],
  //   ...json.configs.recommended,
  // },
  // {
  //   files: ['**/*.json'],
  // },

  //
  // Markdown files
  //
  ...markdown.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.md'],
  })),
  {
    files: ['**/*.md'],
    // GitHub-flavoured: task lists (`- [ ]`) are not label references.
    language: 'markdown/gfm',
    rules: {
      // 'markdown/no-html': 'error',
    },
  },
  {
    // The docs site's Markdown is Nunjucks-templated: code in {% highlight %}
    // blocks ([formControl], [.article]) and links with {{ site.* }} URLs read
    // as missing label references to a plain Markdown parser.
    files: ['docs-site/src/**/*.md'],
    rules: { 'markdown/no-missing-label-refs': 'off' },
  },
];

// For debugging config
// fs.writeFileSync('eslint-config-final.json', stringify(config, null, 2));

export default config;
