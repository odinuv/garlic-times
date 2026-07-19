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

The **Weekly traffic report** workflow (`.github/workflows/analytics-report.yml`)
runs every Monday 07:00 UTC and on demand
(`gh workflow run "Weekly traffic report" --repo odinuv/garlic-times`). It no
longer commits anything to the repo — the numbers live in three places:

- **Analytics Azure Blob container** (`ANALYTICS_BLOB_CONTAINER`, default
  `garlic-times-analytics`, in the same storage account as the pipeline state).
  Per run, keyed by the look-back window's end date:
  - `raw/<YYYY-MM-DD>.json` — the raw structured data pulled from Cloudflare.
  - `reports/<YYYY-MM-DD>.md` — the rendered markdown report.
  - `traffic-log.md` — the rolling, newest-first log (replaces the old git file).
- **Job summary** — the same report renders in each workflow run's summary.
- **Cloudflare dashboard** — Web Analytics view, once the beacon is live.

Read the log or a single run from the blob container (needs the connection
string; the [`az`](https://learn.microsoft.com/cli/azure/) CLI):

```bash
az storage blob download --container-name garlic-times-analytics --name traffic-log.md \
  --file traffic-log.md --connection-string "$AZURE_STORAGE_CONNECTION_STRING"
# per-run: raw/<YYYY-MM-DD>.json  and  reports/<YYYY-MM-DD>.md
```

Run the report by hand (prints + writes the job summary; also persists to the
blob container when `AZURE_STORAGE_CONNECTION_STRING` + `ANALYTICS_BLOB_CONTAINER`
are set — otherwise persistence is skipped and it just prints):

```bash
CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… bun run scripts/analytics-report.ts
# optional: DAYS=30  ZONES="thegarlictimes.com,garlictimes.com"
```

## Token scope

The weekly report uses the existing `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
CI secrets. It needs **Zone → Analytics: Read** (and, for referrers via RUM,
**Account → Account Analytics: Read**). If a query returns a permissions error,
grant those scopes to the token in the Cloudflare dashboard.

If the token can see **no zones at all** (e.g. it's still scoped for Pages
deploys only), the report **fails the run** (non-zero exit) rather than
persisting an empty placeholder — grant the scope above to fix it.

## Email funnel — owned audience (GAR-9)

The web numbers above measure **acquisition**. The same weekly report also carries
an **Email funnel** section measuring **retention/conversion** — the owned audience
we can reach directly — so one read covers both.

- **Source:** MailerLite (`connect.mailerlite.com/api`), pulled by
  `src/newsletter/mailerlite-metrics.ts` and appended to the report by
  `scripts/analytics-report.ts`. It reports the current **subscriber count**
  (the configured group's `active_count`) plus, for every **regular campaign
  sent inside the report window**, its recipients / opens / clicks /
  unsubscribes and a totals row.
- **Config:** `MAILERLITE_API_KEY` (secret) and `MAILERLITE_GROUP_ID` (var) —
  the same credentials the newsletter send uses. If the key is unset or
  MailerLite is unreachable, the section degrades to a placeholder and the
  traffic baseline still runs (the email funnel never fails the web report).
- Lands in the **same** `traffic-log.md` / per-run report in the
  `garlic-times-analytics` blob container as the web baseline.
