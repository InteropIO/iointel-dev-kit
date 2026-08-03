import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // src/io-assist is vendored io.Assist source (see src/io-assist/PROVENANCE.md).
    // It is kept byte-identical to upstream, which does not enforce these rules:
    // react-hooks v7 added set-state-in-effect/refs, and only-export-components is a
    // dev-server concern that never applied to a published library. Downgraded to
    // warnings so `npm run lint` stays green while you still get the signal when you
    // edit this source.
    files: ['src/io-assist/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
