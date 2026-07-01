# Ingest pipeline

`bun run ingest` fetches current CNN and Fox articles, filters and "garlic-ifies"
them through a sequence of Gemini calls, and writes them into
`content/sources/{cnn,fox}/*.json` so `bun run author` picks them up.

## Setup

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`.
2. (Optional) override models with `GEMINI_MODEL_TRIAGE` / `GEMINI_MODEL_BODY`.

## Run

```bash
bun run ingest          # live news → content/sources/ (+ content/img/)
bun run author          # content/sources/ → content/src/<date>.json
bun run generate        # content/src/ → dist/
```

`ingest` clears the previous generated pool (`content/sources/*.json` and
`content/img/<source>-NN-*.jpg`) each run, then writes fresh. It fails loudly if a
source yields fewer than 3 usable articles.

## Stages

fetch (RSS + readability → markdown) → classify (eligibility) →
garlic-title (swap one title noun → garlic) → select (best 4/source) →
body-swap (garlic-swap + shorten) → download image → write source JSON.
