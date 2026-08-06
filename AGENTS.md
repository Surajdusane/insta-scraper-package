# AGENTS.md

## Project
`insta-scraper-package` — an npm package built with **Bun** + **TypeScript**. Runtime: Bun, ES modules.

## Structure
- `src/index.ts` — package entry point (exports the public API)
- `src/*.ts` — implementation modules
- `src/*.test.ts` — tests using `bun:test` (co-located with source)
- `scripts/build.ts` — production build script
- `dist/` — build output (gitignored, published to npm)
- `tsconfig.json` — TS config (strict, declaration emit for types)

## Commands (use Bun, not npm/node)
- `bun install` — install deps
- `bun run dev` — run `src/index.ts` in watch mode
- `bun test` — run all tests
- `bun run typecheck` — `tsc --noEmit` type check (does NOT typecheck `*.test.ts`; src excluded)
- `bun run build` — runs `scripts/build.ts`: emits `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/types/*.d.ts` (types)

## Build output
- `main`: `dist/index.js` (ESM)
- `exports.import` → `dist/index.js`, `exports.require` → `dist/index.cjs`, `exports.types` → `dist/types/index.d.ts`
- `files: ["dist"]` — only `dist/` is published

## Conventions
- Keep the public API exported from `src/index.ts`
- Write tests next to source as `src/foo.test.ts`
- Do not add code comments unless asked; follow existing style
- No secrets or credentials in code or commits
- After changes: run `bun test` and `bun run typecheck`