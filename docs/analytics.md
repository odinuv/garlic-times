# Analytics & traffic baseline

How we measure traffic to The Garlic Times, and where to read the weekly numbers.
Owner: Founding Engineer (Growth). Issue: GAR-2.

## Principles

- **Privacy-friendly by default.** No cookies, no cross-site tracking, no PII.
  Both data sources below are cookieless and GDPR-friendly.
- **Two sources, one picture:**
  1. **Cloudflare zone analytics** — server-side, automatic for every request
     through the edge. Needs no code and works retroactively. Gives page views,
     unique visitors, top pages, and countries.
  2. **Cloudflare Web Analytics (RUM)** — a tiny client-side beacon we emit on
     every page. Adds referrers, entry/exit pages, and load performance. Starts
     collecting only once the beacon token is set (see below).

## What's instrumented

- `src/edition/shell.tsx` renders the shared `<head>` for every page (front
  page, each dated edition, and `/about/`). When the build sees a
  `CF_BEACON_TOKEN`, it emits the Cloudflare Web Analytics beacon:

  ```html
  <script
    defer
    src="https://static.cloudflareinsights.com/beacon.min.js"
    data-cf-beacon='{"token":"<CF_BEACON_TOKEN>"}'
  ></script>
  ```

  With no token the site stays completely script-free (verified by
  `tests/shell.test.tsx`). The token is threaded in by `scripts/generate.ts`
  and passed to `bun run generate` from `.github/workflows/daily.yml`.

## Activating the client-side beacon (one-time, ~2 min)

Requires Cloudflare dashboard access (CEO / account owner):

1. Cloudflare dashboard → **Web Analytics** → add a site for the Pages project
   (or the `thegarlictimes.com` domain).
2. Copy the **beacon token** (the `token` value in the snippet it shows).
3. Add it as a GitHub Actions secret:
   `gh secret set CF_BEACON_TOKEN --repo odinuv/garlic-times`.
4. Next daily build (or a manual `daily.yml` run) ships the beacon. Confirm with
   `curl -s https://www.thegarlictimes.com/ | grep cloudflareinsights`.

Until step 3 is done, referrers and entry/exit metrics stay empty; page views,
uniques, top pages, and countries are already available from zone analytics.

## Where the weekly numbers live (repeatable)

- **`docs/traffic-log.md`** — running log, newest week on top. Written by the
  **Weekly traffic report** workflow (`.github/workflows/analytics-report.yml`),
  which runs every Monday 07:00 UTC and on demand
  (`gh workflow run "Weekly traffic report" --repo odinuv/garlic-times`).
- **Job summary** — the same report renders in each workflow run's summary.
- **Cloudflare dashboard** — Web Analytics view, once the beacon is live.

Run the report by hand:

```bash
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… bun run scripts/analytics-report.ts
# optional: DAYS=30  ZONES="thegarlictimes.com,garlictimes.com"
```

## Token scope

The weekly report uses the existing `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
CI secrets. It needs **Zone → Analytics: Read** (and, for referrers via RUM,
**Account → Account Analytics: Read**). If a query returns a permissions error,
grant those scopes to the token in the Cloudflare dashboard.
