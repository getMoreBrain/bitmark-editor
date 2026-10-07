import js from '@eslint/js';
// import json from '@eslint/json';
import markdown from '@eslint/markdown';
import prettier from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
// import fs from 'fs-extra';
// import globals from 'globals';
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
    // Repo scripts run on Node.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
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
];

// For debugging config
// fs.writeFileSync('eslint-config-final.json', stringify(config, null, 2));

export default config;
