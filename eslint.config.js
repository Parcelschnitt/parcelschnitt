import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['src/core/**/*.ts', 'src/layouts/**/*.ts', 'src/profiles/**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        'document',
        'window',
        'fetch',
        'XMLHttpRequest',
        'WebSocket',
      ],
    },
  },
  {
    // Main-thread UI code must never contain a PDF parser: parsing happens in the worker.
    files: ['src/ui/**/*.ts'],
    ignores: ['src/ui/worker.ts', 'src/ui/preview.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['pdfjs-dist', 'pdfjs-dist/*', '@cantoo/pdf-lib', 'pdf-lib'],
              message: 'PDF parsing belongs in src/ui/worker.ts.',
            },
            {
              group: ['../core/index.ts', '../core/analyze.ts', '../core/crop.ts'],
              allowTypeImports: true,
              message: 'Import only types from the core here; parsing runs in the worker.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
