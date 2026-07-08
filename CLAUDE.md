# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**The Garlic Times** is a static-site generator that produces a satirical vintage newspaper. It ingests real CNN/Fox news, rewrites it through Gemini (swapping words for "garlic"), lays it out as a period-styled front page, and renders static HTML. There is no runtime server — the output is a folder of HTML in `dist/`.

## Commands

Runtime is **Bun** (not Node). `bun` may not be on PATH; the binary is at `C:\Users\ondre\.bun\bin\bun.exe`.

```bash
bun run build          # full chain: ingest → author (today) → generate dist/  (needs GEMINI_API_KEY; hits live network + Gemini)
bun run ingest         # live news → content/sources/{cnn,fox}/*.json (+ content/img/)
bun run author [date]  # content/sources/ → content/src/<date>.json (deterministic; defaults to today UTC)
bun run generate       # content/src/ → dist/ (deterministic; no network)
bun run preview        # serve dist/ at http://localhost:3000

bun test               # run all tests (Bun's built-in runner; there is no "test" npm script)
bun test tests/pipeline/selection.test.ts   # single file
bun test -t "picks stories"                  # by test-name pattern
bun run typecheck      # tsc --noEmit
bun run lint           # eslint .
bun run format         # prettier --write .
```

Config knobs live in `.env` (copy from `.env.example`): `GEMINI_API_KEY` (required for ingest/build), optional `GEMINI_MODEL_TRIAGE` / `GEMINI_MODEL_BODY`.

## Architecture

The system is **three sequential stages**, chained by `scripts/build.ts`. Understand them as a data pipeline where each stage's output is the next stage's input on disk:

1. **Ingest** (`src/ingest/`, orchestrated by `runIngest` in `pipeline.ts`) — *non-deterministic*, uses Gemini + live network. Stages: `fetch` (RSS/sitemap + Readability → markdown) → `classify` (eligibility) → `garlic-title` (swap one title noun for garlic) → `select` (best 4 per source) → `body-swap` (garlic-swap + shorten, one concurrent LLM call per article) → `illustrate` (download/generate image) → `write`. Output: `content/sources/{cnn,fox}/*.json`. Fails loudly if a source yields < 3 usable articles. Clears the previous pool each run.

2. **Author** (`src/pipeline/`, `buildEdition.ts`) — *fully deterministic*, seeded from the date (`mulberry32(seedFromDate(date))`), no network. Loads the source pools, assigns **fixed layout slots** (`selection.ts`: 5 slots; which source leads flips by day-of-year parity), picks stories (image-bearing stories claim the two photo slots), `transformStory` maps each to an `Article` (paragraph count by size, rotating period bylines), adds `staticFields` (masthead, edition number, FX rates, advert) + a recipe, then **validates the whole thing through the Zod schema** before writing `content/src/<date>.json`.

3. **Generate** (`src/edition/`, `scripts/generate.ts`) — *deterministic*, no network. Loads every edition JSON, renders each via React `renderToStaticMarkup` (`shell.tsx` wraps `<Edition>`), compiles Tailwind CSS via the CLI, copies `img/` + `static/` → `dist/`. Newest edition is also written to `dist/index.html`; each edition also lives at `dist/<date>/`. Prev/next navigation is wired by date order.

**`src/edition/schema.ts` is the contract between authoring and rendering.** Any change to edition JSON shape goes here first — `parseEdition` throws a readable error listing every failed field, and both the author step and `loadEditions` call it.

### Key conventions

- **Path alias**: `@/*` → `./src/*` (see `tsconfig.json`). Import as `@/ingest/...`, `@/pipeline/...`, `@/edition/...`.
- **Gemini calls** (`src/ingest/gemini.ts`): JSON response mode, **thinking disabled** (`thinkingBudget: 0`) to avoid truncated-JSON parse failures, generous `maxOutputTokens`. Transient (429/500/503/network) errors retry with exponential backoff (`withRetry`); `completeJson` re-prompts once on invalid JSON. Two models: `triage` (flash) for classify/select, `body` (flash-lite) for rewriting.
- **Determinism boundary**: everything downstream of `content/sources/` is reproducible from the date. Keep it that way — thread the seeded `rng` through, don't call `Math.random()` or `Date.now()` in the author/generate path.
- **Windows/OneDrive gotcha**: `mkdirSync(..., { recursive: true })` can throw `EEXIST` on this filesystem; guard with `existsSync` first (see `author-edition.ts`).
- Generated/ingested content is **gitignored** (`content/sources/`, `content/src/`, `content/img/{cnn,fox}-*`) — it's regenerated locally, never committed. `tmp-src/` is local scratch/source material, also ignored.

### Tests

`bun test` (`tests/` mirrors `src/`). `tests/fixtures/` holds a self-contained mini content tree so pipeline/generate tests run without network or Gemini — the Gemini `complete` function and fetch/image functions are injected as parameters throughout (`runIngest`, `createGeminiComplete`), so tests pass fakes rather than mocking modules.

## Notes

- ESLint config and `components.json` carry vestigial TanStack Start / shadcn scaffolding from the initial Lovable template; the shipping app is the static generator described above and does not run TanStack at runtime.
