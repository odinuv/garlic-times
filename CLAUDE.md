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

1. **Ingest** (`src/ingest/`, orchestrated by `runIngest` in `pipeline.ts`) — _non-deterministic_, uses Gemini + live network. Stages: `fetch` (RSS/sitemap + Readability → markdown) → `classify` (eligibility) → `garlic-title` (swap one title noun for garlic) → `select` (best 4 per source) → `body-swap` (garlic-swap + shorten, one concurrent LLM call per article) → `illustrate` (download/generate image) → `write`. Output: `content/sources/{cnn,fox}/*.json`. Fails loudly if a source yields < 3 usable articles. Clears the previous pool each run.

2. **Author** (`src/pipeline/`, `buildEdition.ts`) — _fully deterministic_, seeded from the date (`mulberry32(seedFromDate(date))`), no network. Loads the source pools, assigns **fixed layout slots** (`selection.ts`: 5 slots; which source leads flips by day-of-year parity), picks stories (image-bearing stories claim the two photo slots), `transformStory` maps each to an `Article` (paragraph count by size, rotating period bylines), adds `staticFields` (masthead, edition number, FX rates, advert) + a recipe, then **validates the whole thing through the Zod schema** before writing `content/src/<date>.json`.

3. **Generate** (`src/edition/`, `scripts/generate.ts`) — _deterministic_, no network. Loads every edition JSON, renders each via React `renderToStaticMarkup` (`shell.tsx` wraps `<Edition>`), compiles Tailwind CSS via the CLI, copies `img/` + `static/` → `dist/`. Newest edition is also written to `dist/index.html`; each edition also lives at `dist/<date>/`. Prev/next navigation is wired by date order.

**`src/edition/schema.ts` is the contract between authoring and rendering.** Any change to edition JSON shape goes here first — `parseEdition` throws a readable error listing every failed field, and both the author step and `loadEditions` call it.

### Weekly pipeline: the Saturday Special

Separate from the daily chain, a **weekly newsletter** runs Saturdays 08:00 UTC
(`.github/workflows/newsletter.yml` → `scripts/send-newsletter.ts`). It restores
blob state, loads the week's **Mon–Fri** editions, and produces a five-article
"editor's picks" digest emailed to MailerLite subscribers. It is **email-only and
never published on the site** — that exclusivity is the subscription incentive; the
daily pipeline is unchanged and still publishes a normal public Saturday paper.

Selection keeps the determinism boundary: an **LLM ranker** (`src/newsletter/rank.ts`,
Gemini, scores each article for comedic quality with a rubric + few-shot exemplars)
feeds a **pure deterministic selector** (`src/newsletter/select.ts`, ISO-week-parity
3/2 source quota + one-pick-per-weekday + relax-day/borrow-source/send-fewer
fallbacks). The ranker is a swappable seam so a future likes-based ranker can
replace it without touching the quota logic. Picks are recorded to
`archive/newsletter/<date>.json` inside the cumulative state tarball (auditable,
idempotent — a recorded date won't re-send unless `FORCE_SEND=1`).

Run locally: `bun run send-newsletter` (needs `GEMINI_API_KEY`; sends only when the
`MAILERLITE_*` vars are set, otherwise builds and prints).

### Weekly analytics: the traffic report

A third scheduled pipeline — **not** part of the daily or newsletter chains — runs
Mondays 07:00 UTC (`.github/workflows/analytics-report.yml` →
`scripts/analytics-report.ts`). It reads live analytics only; it never touches
`content/`, `dist/`, or Gemini. Two data sources, one weekly picture:

- **Web acquisition** — Cloudflare zone analytics via the GraphQL Analytics API
  (cookieless, server-side). The plan caps a query at 1 day wide, so the report
  queries **each UTC calendar day separately and aggregates** (`dayWindows` +
  `mergeCounts`). Each zone shows three side-by-side views: _all traffic_ (raw,
  bot-inflated), _content pages_ (server-side counts filtered to `/`, `/about/`,
  and dated editions), and _human (RUM)_ (the Web Analytics beacon — real
  browsers only). The content/human columns degrade to "—" when their dataset is
  unavailable rather than failing the run.
- **Email retention (GAR-9)** — the MailerLite email funnel
  (`src/newsletter/mailerlite-metrics.ts`), appended as a markdown section over
  the same window. Unlike the web side's per-column degrade, any MailerLite
  problem (missing key, unknown group, API error) **fails the run** — a partial
  report that looks fine is worse than a loud failure.

Output goes to the run's job summary and, when Azure is configured, is persisted
to the analytics Blob container (per-run raw JSON + markdown keyed by until-date,
plus a rolling `traffic-log.md`); nothing is committed back to the repo. Run
locally: `bun run scripts/analytics-report.ts` (needs `CLOUDFLARE_API_TOKEN` /
`CLOUDFLARE_ACCOUNT_ID`, and `MAILERLITE_API_KEY` for the email section; optional
`DAYS`, `ZONES`). The client-side beacon that populates the RUM/referrer numbers
is gated on `CF_BEACON_TOKEN` at generate time — see `docs/analytics.md`.

### Key conventions

- **Path alias**: `@/*` → `./src/*` (see `tsconfig.json`). Import as `@/ingest/...`, `@/pipeline/...`, `@/edition/...`.
- **Gemini calls** (`src/ingest/gemini.ts`): JSON response mode, **thinking disabled** (`thinkingBudget: 0`) to avoid truncated-JSON parse failures, generous `maxOutputTokens`. Transient (429/500/503/network) errors retry with exponential backoff (`withRetry`); `completeJson` re-prompts once on invalid JSON. Two models: `triage` (flash) for classify/select, `body` (flash-lite) for rewriting.
- **Determinism boundary**: everything downstream of `content/sources/` is reproducible from the date. Keep it that way — thread the seeded `rng` through, don't call `Math.random()` or `Date.now()` in the author/generate path.
- **Windows/OneDrive gotcha**: `mkdirSync(..., { recursive: true })` can throw `EEXIST` on this filesystem; guard with `existsSync` first (see `author-edition.ts`).
- Generated/ingested content is **gitignored** (`content/sources/`, `content/src/`, `content/img/{cnn,fox}-*`) — it's regenerated locally, never committed. `tmp-src/` is local scratch/source material, also ignored.

### Tests

`bun test` (`tests/` mirrors `src/`). `tests/fixtures/` holds a self-contained mini content tree so pipeline/generate tests run without network or Gemini — the Gemini `complete` function and fetch/image functions are injected as parameters throughout (`runIngest`, `createGeminiComplete`), so tests pass fakes rather than mocking modules.

## Notes

- Longer-form docs live in `docs/`: `docs/ingest-pipeline.md` (the ingest stages in detail) and `docs/analytics.md` (traffic measurement, the Cloudflare beacon, and activating RUM).
- ESLint config and `components.json` carry vestigial TanStack Start / shadcn scaffolding from the initial Lovable template; the shipping app is the static generator described above and does not run TanStack at runtime.
