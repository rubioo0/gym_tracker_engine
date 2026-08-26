// As of the 2026-08-26 audit cleanup (see AUDIT.md), `npm run lint` reports
// exactly 10 pre-existing errors, 0 warnings -- all in legacy code inherited
// from the original hand-built app (test-logic.ts, storage.ts/.test.ts,
// AIAssistant.tsx, main.tsx) that predates this project's own lint
// discipline. New code should not add to that count; if a change legitimately
// reduces it (e.g. deleting one of the flagged files), update this number.
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
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
