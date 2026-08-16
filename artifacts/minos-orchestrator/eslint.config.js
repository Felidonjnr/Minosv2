// Minimal ESLint flat config for MINOS v2 JS module lint gate (CP3).
// Scope: the pure ES modules only — NOT the immutable HTML UI files.
export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        // Browser + Node runtime globals used by the modules.
        fetch: 'readonly',
        localStorage: 'readonly',
        globalThis: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        console: 'readonly',
        process: 'readonly',
        window: 'readonly',
        document: 'readonly',
        // Node builtins (used by router/prompt for file reads).
        import: 'readonly',
        URL: 'readonly',
        Promise: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-constant-condition': 'warn',
      'no-fallthrough': 'warn',
    },
  },
];
