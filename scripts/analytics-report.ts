// scripts/analytics-report.ts
//
// Weekly traffic baseline report for The Garlic Times.
//
// Cloudflare already collects cookieless, server-side analytics for every
// request that passes through its edge — no beacon required. This script pulls
// the last N days (default 7) from the Cloudflare GraphQL Analytics API and
// prints a markdown summary: pageviews, unique visitors, top pages, and top
// countries per zone. Referrers and entry/exit pages come from Cloudflare Web
// Analytics (RUM) and fill in once the CF_BEACON_TOKEN beacon is live — see
// docs/analytics.md.
//
// Usage (needs env): CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
//   bun run scripts/analytics-report.ts
// Optional: DAYS=7  ZONES="thegarlictimes.com,garlictimes.com"

import { createAzureBlobStore, type BlobStore } from "@/archive/blob";
import { createMailerLiteMetricsClient, renderEmailFunnel } from "@/newsletter/mailerlite-metrics";

const API = "https://api.cloudflare.com/client/v4";
const GQL = `${API}/graphql`;

const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const days = Number(process.env.DAYS ?? "7") || 7;
const zoneFilter = (process.env.ZONES ?? "thegarlictimes.com,garlictimes.com")
  .split(",")
  .map((z) => z.trim().toLowerCase())
  .filter(Boolean);

// A page-views/visitors pair for one of the narrower "cleaner than raw" views of
// the traffic. `visits` is Cloudflare's session-ish "visits" metric (the adaptive
// and RUM datasets expose that, not unique-visitor counts).
export interface SplitMetrics {
  pageViews: number;
  visits: number;
}

// Structured result assembled from Cloudflare before any markdown is rendered.
// renderMarkdown() turns this into the human-readable report; persist() stores
// both the JSON and the markdown in the analytics blob container.
//
// Each zone carries three views of the same week, rendered side by side:
//   - all traffic (`pageViews`/`uniques`/`requests`) — raw zone analytics,
//     bot-inflated (vulnerability scanners hammer /.env, /config/*.json, …);
//   - `content` — server-side counts restricted to real pages (/, /about/, dated
//     editions), so probe-path noise drops out;
//   - `human` — the Cloudflare Web Analytics (RUM) beacon, i.e. page loads that
//     executed JS in a real browser, which excludes virtually all scanners.
// `content`/`human` are null when their dataset is unavailable (scope/beta/no
// beacon) so the column degrades to "—" instead of failing the run.
export interface TrafficReport {
  generatedAt: string; // ISO
  window: { sinceDate: string; untilDate: string; days: number };
  seenZoneCount: number;
  zones: Array<{
    name: string;
    id: string;
    pageViews: number;
    uniques: number;
    requests: number;
    content: SplitMetrics | null;
    human: SplitMetrics | null;
    topPages: { path: string; count: number }[];
    topCountries: { country: string; count: number }[];
    error?: string; // set when this zone's analytics query failed
  }>;
  referrers: { referrer: string; count: number }[] | null;
  totals: { pageViews: number; uniques: number; contentPageViews: number; humanPageViews: number };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Cloudflare's Analytics API on this plan rejects any single query whose time
// range is wider than 1 day. To cover an N-day look-back the report queries each
// UTC calendar day separately and aggregates the results. A DayWindow carries the
// bounds in both shapes the datasets want: `date` for httpRequests1dGroups
// (date_geq/date_leq) and `startTime`/`endTime` for the adaptive datasets
// (datetime_geq/datetime_leq).
export type DayWindow = { date: string; startTime: string; endTime: string };

// Enumerate one <=1-day window per UTC calendar day from `since` to `until`,
// inclusive, oldest first. Exported for tests.
export function dayWindows(since: Date, until: Date): DayWindow[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const first = Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate());
  const last = Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate());
  const windows: DayWindow[] = [];
  for (let ms = first; ms <= last; ms += dayMs) {
    const date = new Date(ms).toISOString().slice(0, 10);
    windows.push({ date, startTime: `${date}T00:00:00Z`, endTime: `${date}T23:59:59Z` });
  }
  return windows;
}

// Sum counts for the same key across all day results, then sort desc and keep
// the top `limit`. The per-day queries each return their own top slice, so this
// is an approximation for keys that rank near the cutoff — good enough for the
// traffic volumes here, and the only option under the 1-day-per-query limit.
// Exported for tests.
export function mergeCounts(
  items: { key: string; count: number }[],
  limit: number,
): { key: string; count: number }[] {
  const totals = new Map<string, number>();
  for (const { key, count } of items) totals.set(key, (totals.get(key) ?? 0) + count);
  return [...totals.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// GraphQL filter clauses that match only the site's real pages: the front page
// (`/`), the about page, and each day's dated edition (`/<YYYY-MM-DD>/`). Editions
// and /about use `_like` so a missing/extra trailing slash still matches; `/` must
// be exact (a `/%` wildcard would match everything). These paths are all literals
// or ISO dates we generate, so string-building the clause is injection-safe.
// Exported for tests.
export function contentPathFilters(days: DayWindow[]): string[] {
  return [
    `{ clientRequestPath: "/" }`,
    `{ clientRequestPath_like: "/about%" }`,
    ...days.map((w) => `{ clientRequestPath_like: "/${w.date}%" }`),
  ];
}

const now = new Date();
const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const sinceDate = isoDate(since);
const untilDate = isoDate(now);
const windows = dayWindows(since, now);

type Zone = { id: string; name: string };

// Loose shapes for the two Cloudflare surfaces we touch. Only the fields this
// script reads are modelled — the APIs return much more.
type CfRestResponse = {
  success?: boolean;
  result?: unknown;
  errors?: { code?: number; message?: string }[];
};
type AdaptiveGroup = { count?: number; dimensions?: Record<string, string> };
type Requests1dGroup = {
  sum?: { pageViews?: number; requests?: number };
  uniq?: { uniques?: number };
};

async function cfGet(path: string): Promise<CfRestResponse> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const json = (await res.json()) as CfRestResponse;
  if (!res.ok || json.success === false) {
    const msg = json.errors?.map((e) => `${e.code} ${e.message}`).join("; ") || res.statusText;
    throw new Error(`Cloudflare REST ${path} failed: ${msg}`);
  }
  return json;
}

async function gql<T = unknown>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(GQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data as T;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Run `fn` once per day window (concurrently) and collect the successes.
// Tolerates days that error individually — e.g. beyond the plan's retention —
// but rethrows the first error if EVERY day failed, so a genuine permission or
// scope error still surfaces loudly (matching the pre-chunking behavior).
async function forEachDay<T>(fn: (w: DayWindow) => Promise<T>): Promise<T[]> {
  const results: T[] = [];
  const errors: unknown[] = [];
  await Promise.all(
    windows.map(async (w) => {
      try {
        results.push(await fn(w));
      } catch (err) {
        errors.push(err);
      }
    }),
  );
  if (!results.length) {
    throw errors[0] instanceof Error
      ? errors[0]
      : new Error(String(errors[0] ?? "all day queries failed"));
  }
  return results;
}

async function resolveZones(): Promise<{ zones: Zone[]; seenCount: number }> {
  // Primary: REST /zones (needs Zone:Read). Fallback: GraphQL viewer.zones,
  // which lists whatever zones the token is scoped to see.
  let all: Zone[] = [];
  try {
    const q = accountId ? `?account.id=${accountId}&per_page=50` : `?per_page=50`;
    const json = await cfGet(`/zones${q}`);
    const result = (json.result ?? []) as { id: string; name: string }[];
    all = result.map((z) => ({ id: z.id, name: z.name }));
  } catch {
    // fall through to GraphQL
  }
  if (!all.length) {
    try {
      const data = await gql<{ viewer?: { zones?: { zoneTag: string }[] } }>(
        `query { viewer { zones { zoneTag } } }`,
        {},
      );
      all = (data?.viewer?.zones ?? []).map((z) => ({ id: z.zoneTag, name: z.zoneTag }));
    } catch {
      // token cannot see any zones
    }
  }
  const matched = all.filter((z) => zoneFilter.some((f) => z.name.toLowerCase() === f));
  return { zones: matched.length ? matched : all, seenCount: all.length };
}

async function zoneTotals(zoneId: string) {
  // One query per day (the plan caps a query at 1 day wide), then sum. Summing
  // daily uniques across days over-counts repeat visitors — but the previous
  // single-query version summed the per-day httpRequests1dGroups the same way,
  // so this preserves that behavior.
  const perDay = await forEachDay(async (w) => {
    const data = await gql<{
      viewer?: { zones?: { httpRequests1dGroups?: Requests1dGroup[] }[] };
    }>(
      `query ($zoneTag: String!, $date: String!) {
        viewer { zones(filter: { zoneTag: $zoneTag }) {
          httpRequests1dGroups(limit: 1, filter: { date_geq: $date, date_leq: $date }) {
            sum { pageViews requests }
            uniq { uniques }
          }
        } }
      }`,
      { zoneTag: zoneId, date: w.date },
    );
    const groups = data?.viewer?.zones?.[0]?.httpRequests1dGroups ?? [];
    let pageViews = 0,
      requests = 0,
      uniques = 0;
    for (const g of groups) {
      pageViews += g.sum?.pageViews ?? 0;
      requests += g.sum?.requests ?? 0;
      uniques += g.uniq?.uniques ?? 0;
    }
    return { pageViews, requests, uniques };
  });
  return perDay.reduce(
    (acc, d) => ({
      pageViews: acc.pageViews + d.pageViews,
      requests: acc.requests + d.requests,
      uniques: acc.uniques + d.uniques,
    }),
    { pageViews: 0, requests: 0, uniques: 0 },
  );
}

async function topPages(zoneId: string) {
  const perDay = await forEachDay(async (w) => {
    const data = await gql<{
      viewer?: { zones?: { httpRequestsAdaptiveGroups?: AdaptiveGroup[] }[] };
    }>(
      `query ($zoneTag: String!, $since: String!, $until: String!) {
        viewer { zones(filter: { zoneTag: $zoneTag }) {
          httpRequestsAdaptiveGroups(
            limit: 15
            filter: { datetime_geq: $since, datetime_leq: $until, edgeResponseStatus: 200, requestSource: "eyeball" }
            orderBy: [count_DESC]
          ) {
            count
            dimensions { clientRequestPath }
          }
        } }
      }`,
      { zoneTag: zoneId, since: w.startTime, until: w.endTime },
    );
    const groups = data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    return groups.map((g) => ({
      key: g.dimensions?.clientRequestPath ?? "?",
      count: g.count ?? 0,
    }));
  });
  const items = perDay
    .flat()
    .filter((r) => !/\.(css|js|png|jpe?g|svg|ico|webp|woff2?|txt|xml)$/i.test(r.key));
  return mergeCounts(items, 10).map((r) => ({ path: r.key, count: r.count }));
}

async function topCountries(zoneId: string) {
  const perDay = await forEachDay(async (w) => {
    const data = await gql<{
      viewer?: { zones?: { httpRequestsAdaptiveGroups?: AdaptiveGroup[] }[] };
    }>(
      `query ($zoneTag: String!, $since: String!, $until: String!) {
        viewer { zones(filter: { zoneTag: $zoneTag }) {
          httpRequestsAdaptiveGroups(
            limit: 10
            filter: { datetime_geq: $since, datetime_leq: $until, requestSource: "eyeball" }
            orderBy: [count_DESC]
          ) {
            count
            dimensions { clientCountryName }
          }
        } }
      }`,
      { zoneTag: zoneId, since: w.startTime, until: w.endTime },
    );
    const groups = data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
    return groups.map((g) => ({
      key: g.dimensions?.clientCountryName ?? "?",
      count: g.count ?? 0,
    }));
  });
  return mergeCounts(perDay.flat(), 10).map((r) => ({ country: r.key, count: r.count }));
}

// Server-side page views + visits restricted to the site's real content pages
// (see contentPathFilters). One adaptive query per day (aggregate, no groupBy),
// summed. Returns null — and logs — if the dataset/metric is unavailable, so the
// column degrades to "—" without failing the zone.
async function contentTotals(zoneId: string): Promise<SplitMetrics | null> {
  const orClause = contentPathFilters(windows).join(", ");
  try {
    const perDay = await forEachDay(async (w) => {
      const data = await gql<{
        viewer?: {
          zones?: {
            httpRequestsAdaptiveGroups?: { count?: number; sum?: { visits?: number } }[];
          }[];
        };
      }>(
        `query ($zoneTag: String!, $since: String!, $until: String!) {
          viewer { zones(filter: { zoneTag: $zoneTag }) {
            httpRequestsAdaptiveGroups(
              limit: 1
              filter: { datetime_geq: $since, datetime_leq: $until, edgeResponseStatus: 200, requestSource: "eyeball", OR: [${orClause}] }
            ) {
              count
              sum { visits }
            }
          } }
        }`,
        { zoneTag: zoneId, since: w.startTime, until: w.endTime },
      );
      const g = data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups?.[0];
      return { pageViews: g?.count ?? 0, visits: g?.sum?.visits ?? 0 };
    });
    return perDay.reduce(
      (acc, d) => ({ pageViews: acc.pageViews + d.pageViews, visits: acc.visits + d.visits }),
      { pageViews: 0, visits: 0 },
    );
  } catch (err) {
    console.error(`content-page analytics unavailable for ${zoneId}: ${errMessage(err)}`);
    return null;
  }
}

// Human page views + visits from the Web Analytics (RUM) beacon, grouped by the
// page's host so each zone can be matched to its own numbers. RUM is account-level
// and beta; returns null — and logs — if it's unavailable (no beacon, missing
// scope, or a schema mismatch), so the column degrades to "—".
async function humanTotalsByHost(): Promise<Map<string, SplitMetrics> | null> {
  if (!accountId) return null;
  try {
    const perDay = await forEachDay(async (w) => {
      const data = await gql<{
        viewer?: {
          accounts?: {
            rumPageloadEventsAdaptiveGroups?: {
              count?: number;
              sum?: { visits?: number };
              dimensions?: { requestHost?: string };
            }[];
          }[];
        };
      }>(
        `query ($accountTag: String!, $since: String!, $until: String!) {
          viewer { accounts(filter: { accountTag: $accountTag }) {
            rumPageloadEventsAdaptiveGroups(
              limit: 100
              filter: { datetime_geq: $since, datetime_leq: $until }
              orderBy: [count_DESC]
            ) {
              count
              sum { visits }
              dimensions { requestHost }
            }
          } }
        }`,
        { accountTag: accountId, since: w.startTime, until: w.endTime },
      );
      return data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    });
    const byHost = new Map<string, SplitMetrics>();
    for (const g of perDay.flat()) {
      const host = (g.dimensions?.requestHost ?? "").toLowerCase();
      if (!host) continue;
      const prev = byHost.get(host) ?? { pageViews: 0, visits: 0 };
      byHost.set(host, {
        pageViews: prev.pageViews + (g.count ?? 0),
        visits: prev.visits + (g.sum?.visits ?? 0),
      });
    }
    return byHost;
  } catch (err) {
    console.error(`RUM (human) analytics unavailable: ${errMessage(err)}`);
    return null;
  }
}

// Sum the RUM buckets belonging to a zone: its apex host and any subdomain of it
// (e.g. www.<zone>). Returns null when RUM itself was unavailable.
function humanForZone(
  byHost: Map<string, SplitMetrics> | null,
  zoneName: string,
): SplitMetrics | null {
  if (!byHost) return null;
  const name = zoneName.toLowerCase();
  const total = { pageViews: 0, visits: 0 };
  for (const [host, m] of byHost) {
    if (host === name || host.endsWith(`.${name}`)) {
      total.pageViews += m.pageViews;
      total.visits += m.visits;
    }
  }
  return total;
}

// Referrers + entry pages from Cloudflare Web Analytics (RUM). Empty until the
// CF_BEACON_TOKEN beacon has been live and collecting.
async function topReferrers(): Promise<{ referrer: string; count: number }[] | null> {
  if (!accountId) return null;
  try {
    const perDay = await forEachDay(async (w) => {
      const data = await gql<{
        viewer?: { accounts?: { rumPageloadEventsAdaptiveGroups?: AdaptiveGroup[] }[] };
      }>(
        `query ($accountTag: String!, $since: String!, $until: String!) {
          viewer { accounts(filter: { accountTag: $accountTag }) {
            rumPageloadEventsAdaptiveGroups(
              limit: 10
              filter: { datetime_geq: $since, datetime_leq: $until }
              orderBy: [count_DESC]
            ) {
              count
              dimensions { refererHost }
            }
          } }
        }`,
        { accountTag: accountId, since: w.startTime, until: w.endTime },
      );
      const groups = data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
      return groups.map((g) => ({
        key: g.dimensions?.refererHost || "(direct)",
        count: g.count ?? 0,
      }));
    });
    return mergeCounts(perDay.flat(), 10).map((r) => ({ referrer: r.key, count: r.count }));
  } catch {
    return null; // RUM not enabled yet, or token lacks account analytics scope.
  }
}

function table(rows: string[][], headers: string[]): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.length
    ? rows.map((r) => `| ${r.join(" | ")} |`).join("\n")
    : `| ${headers.map(() => "—").join(" | ")} |`;
  return [head, sep, body].join("\n");
}

// Gather the structured report from Cloudflare. Pure data — no markdown.
async function buildReport(): Promise<TrafficReport> {
  const { zones, seenCount } = await resolveZones();
  const report: TrafficReport = {
    generatedAt: now.toISOString(),
    window: { sinceDate, untilDate, days },
    seenZoneCount: seenCount,
    zones: [],
    referrers: null,
    totals: { pageViews: 0, uniques: 0, contentPageViews: 0, humanPageViews: 0 },
  };

  if (!zones.length) {
    // No analytics to report — fail the run rather than emitting a placeholder.
    throw new Error(
      seenCount === 0
        ? "No zones visible to this API token. Grant CLOUDFLARE_API_TOKEN the Zone → Analytics: Read scope (and Account → Account Analytics: Read for RUM referrers). See docs/analytics.md."
        : `No zones matched the site filter (${zoneFilter.join(", ")}) among ${seenCount} visible zone(s). Set the ZONES env to one of them.`,
    );
  }

  // Human/RUM is account-level (one query set, then matched to zones by host).
  const humanByHost = await humanTotalsByHost();

  for (const z of zones) {
    try {
      const totals = await zoneTotals(z.id);
      const [pages, countries, content] = await Promise.all([
        topPages(z.id),
        topCountries(z.id),
        contentTotals(z.id),
      ]);
      const human = humanForZone(humanByHost, z.name);
      report.zones.push({
        name: z.name,
        id: z.id,
        pageViews: totals.pageViews,
        uniques: totals.uniques,
        requests: totals.requests,
        content,
        human,
        topPages: pages,
        topCountries: countries,
      });
      report.totals.pageViews += totals.pageViews;
      report.totals.uniques += totals.uniques;
      report.totals.contentPageViews += content?.pageViews ?? 0;
      report.totals.humanPageViews += human?.pageViews ?? 0;
    } catch (err) {
      report.zones.push({
        name: z.name,
        id: z.id,
        pageViews: 0,
        uniques: 0,
        requests: 0,
        content: null,
        human: null,
        topPages: [],
        topCountries: [],
        error: errMessage(err),
      });
    }
  }

  report.referrers = await topReferrers();
  return report;
}

// Render the report to markdown — byte-for-byte the same output the workflow
// job summary showed before this change. Pure and exported for tests.
export function renderMarkdown(report: TrafficReport): string {
  const { sinceDate, untilDate, days } = report.window;
  const lines: string[] = [];
  lines.push(`## Traffic baseline — ${sinceDate} → ${untilDate} (${days}d)`);
  lines.push("");
  lines.push(
    `_Source: Cloudflare zone analytics (cookieless, server-side). Generated by \`scripts/analytics-report.ts\`._`,
  );
  lines.push("");

  for (const z of report.zones) {
    lines.push(`### ${z.name}`);
    if (z.error) {
      lines.push("");
      lines.push(`> ⚠️ Could not read analytics for this zone: ${z.error}`);
    } else {
      lines.push("");
      lines.push(
        table(
          [
            [
              "Page views",
              String(z.pageViews),
              z.content ? String(z.content.pageViews) : "—",
              z.human ? String(z.human.pageViews) : "—",
            ],
            [
              "Visitors",
              String(z.uniques),
              z.content ? String(z.content.visits) : "—",
              z.human ? String(z.human.visits) : "—",
            ],
            ["Total requests", String(z.requests), "—", "—"],
          ],
          ["Metric", `All traffic (${days}d)`, "Content pages", "Human (RUM)"],
        ),
      );
      lines.push("");
      lines.push(
        "_**All traffic** is raw Cloudflare zone analytics — includes bots/scanners hammering probe paths. " +
          "**Content pages** counts only real pages (`/`, `/about/`, dated editions), server-side. " +
          "**Human (RUM)** is the Web Analytics beacon: page loads that ran JS in a real browser, so scanners drop out. " +
          "Visitors = unique visitors for All traffic, Cloudflare “visits” for the other two._",
      );
      lines.push("");
      lines.push("**Top pages**");
      lines.push(
        table(
          z.topPages.map((p) => [p.path, String(p.count)]),
          ["Path", "Views"],
        ),
      );
      lines.push("");
      lines.push("**Top countries**");
      lines.push(
        table(
          z.topCountries.map((c) => [c.country, String(c.count)]),
          ["Country", "Requests"],
        ),
      );
    }
    lines.push("");
  }

  lines.push("### Top referrers (Web Analytics / RUM)");
  if (report.referrers === null) {
    lines.push("");
    lines.push(
      "_Not available yet — enable Cloudflare Web Analytics (set `CF_BEACON_TOKEN`) and allow ~1 week of data. See docs/analytics.md._",
    );
  } else {
    lines.push("");
    lines.push(
      table(
        report.referrers.map((r) => [r.referrer, String(r.count)]),
        ["Referrer", "Pageloads"],
      ),
    );
  }
  lines.push("");
  lines.push(
    `**Totals across zones (last ${days}d):** ${report.totals.pageViews} all-traffic page views · ` +
      `${report.totals.contentPageViews} content-page views · ${report.totals.humanPageViews} human (RUM) page views.`,
  );

  return lines.join("\n");
}

async function emit(markdown: string) {
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY)
    await Bun.write(process.env.GITHUB_STEP_SUMMARY, markdown + "\n");
}

// Persist to the analytics blob container: per-run raw JSON + markdown (keyed by
// the until-date, so re-runs overwrite rather than accumulate), plus a rolling,
// newest-first human-readable log that replaces the old committed git file.
export async function persist(store: BlobStore, report: TrafficReport, markdown: string) {
  const key = report.window.untilDate; // YYYY-MM-DD
  await store.uploadText(`raw/${key}.json`, JSON.stringify(report, null, 2));
  await store.uploadText(`reports/${key}.md`, markdown);
  const prev =
    (await store.downloadText("traffic-log.md")) ??
    "# Traffic log\n\nWeekly baselines, newest first.\n";
  await store.uploadText("traffic-log.md", `\n---\n\n${markdown}\n${prev}`);
}

// GAR-9: the MailerLite email funnel, rendered as a markdown section appended to
// the traffic report so one weekly read covers web acquisition (Cloudflare) and
// email retention (owned audience). Uses the same window as the web report.
// Degrades to a placeholder — never throws — so a MailerLite outage or missing
// key can't fail the traffic baseline the board relies on.
async function emailFunnelSection(sinceDate: string, days: number): Promise<string> {
  const apiKey = process.env.MAILERLITE_API_KEY?.trim();
  if (!apiKey) {
    console.error("MAILERLITE_API_KEY not set; skipping email funnel section.");
    return (
      "### Email funnel — owned audience\n\n" +
      "_Not available — set `MAILERLITE_API_KEY` to include MailerLite subscriber + campaign metrics (GAR-9)._"
    );
  }
  try {
    const client = createMailerLiteMetricsClient(apiKey);
    const metrics = await client.fetchMetrics({
      groupId: process.env.MAILERLITE_GROUP_ID?.trim() || undefined,
      sinceDate,
      days,
    });
    return renderEmailFunnel(metrics);
  } catch (err) {
    console.error(`MailerLite metrics unavailable: ${errMessage(err)}`);
    return `### Email funnel — owned audience\n\n> ⚠️ Could not read MailerLite metrics: ${errMessage(err)}`;
  }
}

async function main() {
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN is not set");
  const report = await buildReport();
  const emailSection = await emailFunnelSection(report.window.sinceDate, report.window.days);
  const markdown = `${renderMarkdown(report)}\n\n${emailSection}`;
  await emit(markdown);

  // Persist only when the Azure analytics container is configured. Local dev
  // (no Azure env) still prints + writes the job summary and exits 0.
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  const container = process.env.ANALYTICS_BLOB_CONTAINER?.trim();
  if (connectionString && container) {
    await persist(createAzureBlobStore({ connectionString, container }), report, markdown);
    console.log(`\nPersisted report to Azure Blob container "${container}".`);
  } else {
    console.log("\nAzure Blob not configured; skipping persistence (report emitted only).");
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
