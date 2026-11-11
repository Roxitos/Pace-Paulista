import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'coverage/', 'docs/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js', 'scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  prettier,
];
