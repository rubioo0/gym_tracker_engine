# Training OS - Adaptive Engine

Rewrite of [gym_tracker](https://github.com/rubioo0/gym_tracker) around an actual training engine instead of a flat state. Handles focus-muscle rotation, load/deload safety limits (ACWR-based), auto-correction after missed sessions.

Split into proper layers (domain/application/infrastructure/services) with tests and CI this time.

Still mid-migration - see AUDIT.md for what's done vs what's still wired to the old code. Some of the engine logic (auto focus rotation, deload triggers) is built and tested but not hooked up to the UI yet.

React 19, TypeScript, Vite, IndexedDB, Gemini API.

## Run it

    npm install
    npm run dev

`npm test` to run tests.
