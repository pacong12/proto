import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import pluginVue from 'eslint-plugin-vue';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  prettierConfig,
  {
    ignores: [
      '**/dist/**',
      '**/out/**',
      '**/node_modules/**',
      '**/cache/**',
      '**/artifacts/**',
      '**/coverage/**',
      'contracts/lib/**',
      'contracts/out/**',
      'contracts/cache/**',
      '.nx/**',
      '**/.wrangler/**',
    ],
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
    rules: {
      // Props are declared with TypeScript: an optional prop is undefined unless it is passed.
      'vue/require-default-prop': 'off',
    },
  },
  {
    // shadcn-vue primitives keep their single-word names (Button, Card, Dialog...), and the docs
    // theme registers some of them under those names for the Markdown pages.
    files: ['apps/*/src/components/ui/**/*.vue', 'apps/docs/.vitepress/theme/**'],
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-reserved-component-names': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.mjs', '**/*.vue'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js', 'scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
