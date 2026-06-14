# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

@AGENTS.md

## Commands

```bash
npm run dev            # Dev server (Turbopack) at http://localhost:3000
npm run build          # Production build (also runs tsc)
npm start              # Serve the production build

npm run lint           # ESLint            | npm run lint:fix   to autofix
npm run format         # Prettier write    | npm run format:check  (used by CI)
npm run typecheck      # tsc --noEmit

npm test               # Vitest, single run
npm run test:watch     # Vitest watch mode
npm run test:coverage  # Vitest with coverage
```

Run a single test file or by name:

```bash
npx vitest run src/components/greeting.test.tsx
npx vitest run -t "renders the provided name"
```

## Architecture

Next.js (App Router) + React + TypeScript, Tailwind v4. Source lives under `src/`; the `@/*` import alias maps to `./src/*` (defined in `tsconfig.json` and resolved in tests via Vitest's `resolve.tsconfigPaths`).

Key conventions that aren't obvious from the file tree:

- **Environment variables go through `src/env.ts`.** It validates `process.env` with Zod at startup and exports a typed `env`. Import `env` from there — do not read `process.env` directly. To add a variable, add it to the schema in that file; browser-exposed vars must be prefixed `NEXT_PUBLIC_`. `.env.example` documents the expected keys.

- **Strict TypeScript.** `tsconfig.json` enables `noUncheckedIndexedAccess` (indexed access is `T | undefined`), `noImplicitOverride`, `noFallthroughCasesInSwitch`, and `verbatimModuleSyntax` (use `import type { ... }` for type-only imports, or the build/lint will fail).

- **Tests are colocated** next to source as `*.test.tsx` / `*.spec.tsx` (Vitest `include` is `src/**/*.{test,spec}.{ts,tsx}`). The environment is jsdom with globals enabled; `vitest.setup.ts` registers `@testing-library/jest-dom` matchers and auto-cleans the DOM after each test.

- **ESLint uses flat config** (`eslint.config.mjs`): `eslint-config-next` rules plus `eslint-config-prettier` last to disable formatting rules. Formatting is owned by Prettier, not ESLint.

## Pre-commit

A husky hook (`.husky/pre-commit`) runs `lint-staged`, which applies `eslint --fix` + `prettier --write` to staged files. Note this does **not** run `typecheck` or tests — run those (or rely on CI) before relying on a commit being green.

## CI

`.github/workflows/ci.yml` runs lint → format:check → typecheck → test → build on pushes to `main` and all PRs. Keep these passing; `format:check` fails on unformatted files, so run `npm run format` before pushing.
