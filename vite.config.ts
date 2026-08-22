import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/gym_tracker_engine/',
  plugins: [react()],
  // Pure-function/reducer tests run in the default 'node' environment (fast,
  // no DOM). Component smoke tests (src/**/*.dom.test.tsx) opt into jsdom
  // individually via a `// @vitest-environment jsdom` docblock instead of a
  // global/glob switch, since this Vitest version's InlineConfig type
  // doesn't expose environmentMatchGlobs.
})
