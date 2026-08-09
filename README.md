# The Garlic Times

**The reasoning and process behind this is described in a [separate article](https://medium.com/codetodeploy/the-anatomy-of-a-fake-news-site-8275d2c4adbc).**

A fictional broadsheet rendered for the modern web in the style of the great London papers of 1930–1970. Every edition is set in black and white and regenerated daily.

Under the hood it's a static-site generator: it pulls real CNN and Fox headlines, rewrites them through Google Gemini (swapping words for _garlic_), lays the results out as a period front page, and renders plain HTML. There is no runtime server — the build output is a folder of static files.

## How it works

The build runs in three sequential stages:

1. **Ingest** — fetch live CNN/Fox articles, filter for eligibility, "garlic-ify" the titles and bodies through Gemini, pick the best few per source, and attach images. → writes `content/sources/{cnn,fox}/*.json`
2. **Author** — deterministically assemble one day's edition (layout, headlines, recipe, masthead, mock FX rates) from the source pool. → writes `content/src/<date>.json`
3. **Generate** — render every edition to static HTML with React, compile the CSS, and copy assets. → writes `dist/`

The authoring and generate stages are fully deterministic and seeded from the date, so a given day's edition always builds the same way. Only ingest touches the network.

## Setup

Requires [Bun](https://bun.sh).

```bash
bun install
cp .env.example .env      # then set GEMINI_API_KEY
```

Get a Gemini API key from <https://aistudio.google.com/apikey>.

## Usage

```bash
bun run build       # full pipeline: ingest → author today → generate dist/ (needs GEMINI_API_KEY)
bun run preview     # serve dist/ at http://localhost:3000
```

The individual stages can also be run on their own:

```bash
bun run ingest          # live news → content/sources/
bun run author [date]   # content/sources/ → content/src/<date>.json (defaults to today)
bun run generate        # content/src/ → dist/ (no network, no API key)
```

`ingest` clears the previous pool each run and fails loudly if a source yields fewer than three usable articles. `generate` and `author` need no API key.

## Development

```bash
bun test            # run the test suite
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run format      # prettier --write
```

## Configuration

Set in `.env` (see `.env.example`):

| Variable              | Purpose                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `GEMINI_API_KEY`      | Required for `ingest` / `build`.                                           |
| `GEMINI_MODEL_TRIAGE` | Optional. Model for classification/selection (default `gemini-2.5-flash`). |
| `GEMINI_MODEL_BODY`   | Optional. Model for rewriting bodies (default `gemini-2.5-flash-lite`).    |

## Project layout

```
src/ingest/      News ingestion + Gemini rewriting (stage 1)
src/pipeline/    Deterministic edition authoring (stage 2)
src/edition/     Schema + React rendering to HTML (stage 3)
scripts/         CLI entry points (build, ingest, author, generate, serve)
content/         Source material, recipes, images, generated editions
tests/           Test suite mirroring src/, with self-contained fixtures
```

See [`docs/ingest-pipeline.md`](docs/ingest-pipeline.md) for details on the ingest stages.
