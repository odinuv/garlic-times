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

const API = "https://api.cloudflare.com/client/v4";
const GQL = `${API}/graphql`;

const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const days = Number(process.env.DAYS ?? "7") || 7;
const zoneFilter = (process.env.ZONES ?? "thegarlictimes.com,garlictimes.com")
  .split(",")
  .map((z) => z.trim().toLowerCase())
  .filter(Boolean);

if (!token) throw new Error("CLOUDFLARE_API_TOKEN is not set");

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
const now = new Date();
const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const sinceDate = isoDate(since);
const untilDate = isoDate(now);
const sinceDateTime = since.toISOString();
const untilDateTime = now.toISOString();

type Zone = { id: string; name: string };

async function cfGet(path: string): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok || json.success === false) {
    const msg = json.errors?.map((e: any) => `${e.code} ${e.message}`).join("; ") || res.statusText;
    throw new Error(`Cloudflare REST ${path} failed: ${msg}`);
  }
  return json;
}

async function gql(query: string, variables: Record<string, unknown>): Promise<any> {
  const res = await fetch(GQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors.map((e: any) => e.message).join("; ")}`);
  }
  return json.data;
}

async function resolveZones(): Promise<{ zones: Zone[]; seenCount: number }> {
  // Primary: REST /zones (needs Zone:Read). Fallback: GraphQL viewer.zones,
  // which lists whatever zones the token is scoped to see.
  let all: Zone[] = [];
  try {
    const q = accountId ? `?account.id=${accountId}&per_page=50` : `?per_page=50`;
    const json = await cfGet(`/zones${q}`);
    all = (json.result ?? []).map((z: any) => ({ id: z.id, name: z.name }));
  } catch {
    // fall through to GraphQL
  }
  if (!all.length) {
    try {
      const data = await gql(`query { viewer { zones { zoneTag } } }`, {});
      all = (data?.viewer?.zones ?? []).map((z: any) => ({ id: z.zoneTag, name: z.zoneTag }));
    } catch {
      // token cannot see any zones
    }
  }
  const matched = all.filter((z) => zoneFilter.some((f) => z.name.toLowerCase() === f));
  return { zones: matched.length ? matched : all, seenCount: all.length };
}

async function zoneTotals(zoneId: string) {
  const data = await gql(
    `query ($zoneTag: String!, $since: String!, $until: String!) {
      viewer { zones(filter: { zoneTag: $zoneTag }) {
        httpRequests1dGroups(limit: 100, filter: { date_geq: $since, date_leq: $until }) {
          sum { pageViews requests }
          uniq { uniques }
        }
      } }
    }`,
    { zoneTag: zoneId, since: sinceDate, until: untilDate },
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
}

async function topPages(zoneId: string) {
  const data = await gql(
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
    { zoneTag: zoneId, since: sinceDateTime, until: untilDateTime },
  );
  const groups = data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
  return groups
    .map((g: any) => ({ path: g.dimensions?.clientRequestPath ?? "?", count: g.count ?? 0 }))
    .filter((r: any) => !/\.(css|js|png|jpe?g|svg|ico|webp|woff2?|txt|xml)$/i.test(r.path))
    .slice(0, 10);
}

async function topCountries(zoneId: string) {
  const data = await gql(
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
    { zoneTag: zoneId, since: sinceDateTime, until: untilDateTime },
  );
  const groups = data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
  return groups.map((g: any) => ({
    country: g.dimensions?.clientCountryName ?? "?",
    count: g.count ?? 0,
  }));
}

// Referrers + entry pages from Cloudflare Web Analytics (RUM). Empty until the
// CF_BEACON_TOKEN beacon has been live and collecting.
async function topReferrers(): Promise<{ referrer: string; count: number }[] | null> {
  if (!accountId) return null;
  try {
    const data = await gql(
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
      { accountTag: accountId, since: sinceDateTime, until: untilDateTime },
    );
    const groups = data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups ?? [];
    return groups.map((g: any) => ({
      referrer: g.dimensions?.refererHost || "(direct)",
      count: g.count ?? 0,
    }));
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

async function emit(lines: string[]) {
  const report = lines.join("\n");
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY)
    await Bun.write(process.env.GITHUB_STEP_SUMMARY, report + "\n");
  if (process.env.REPORT_OUT) await Bun.write(process.env.REPORT_OUT, report + "\n");
}

async function main() {
  const { zones, seenCount } = await resolveZones();
  const lines: string[] = [];
  lines.push(`## Traffic baseline — ${sinceDate} → ${untilDate} (${days}d)`);
  lines.push("");
  lines.push(
    `_Source: Cloudflare zone analytics (cookieless, server-side). Generated by \`scripts/analytics-report.ts\`._`,
  );
  lines.push("");

  if (!zones.length) {
    lines.push(
      seenCount === 0
        ? "> **No zones visible to this API token.** The current `CLOUDFLARE_API_TOKEN` is scoped for Pages deploys only. Grant it **Zone → Analytics: Read** (and Account → Account Analytics: Read for RUM referrers) to populate this report. See docs/analytics.md."
        : `> No zones matched the site filter (\`${zoneFilter.join(", ")}\`) among ${seenCount} visible zone(s). Set the ZONES env to one of them.`,
    );
    await emit(lines);
    return; // not an error — a known, documented state until token scope is granted
  }

  let grandPV = 0,
    grandUniq = 0;
  for (const z of zones) {
    lines.push(`### ${z.name}`);
    try {
      const totals = await zoneTotals(z.id);
      grandPV += totals.pageViews;
      grandUniq += totals.uniques;
      lines.push("");
      lines.push(
        table(
          [
            ["Page views", String(totals.pageViews)],
            ["Unique visitors", String(totals.uniques)],
            ["Total requests", String(totals.requests)],
          ],
          ["Metric", `Last ${days}d`],
        ),
      );
      const [pages, countries] = await Promise.all([topPages(z.id), topCountries(z.id)]);
      lines.push("");
      lines.push("**Top pages**");
      lines.push(
        table(
          pages.map((p: { path: string; count: number }) => [p.path, String(p.count)]),
          ["Path", "Views"],
        ),
      );
      lines.push("");
      lines.push("**Top countries**");
      lines.push(
        table(
          countries.map((c: { country: string; count: number }) => [c.country, String(c.count)]),
          ["Country", "Requests"],
        ),
      );
    } catch (err) {
      lines.push("");
      lines.push(
        `> ⚠️ Could not read analytics for this zone: ${err instanceof Error ? err.message : err}`,
      );
    }
    lines.push("");
  }

  const referrers = await topReferrers();
  lines.push("### Top referrers (Web Analytics / RUM)");
  if (referrers === null) {
    lines.push("");
    lines.push(
      "_Not available yet — enable Cloudflare Web Analytics (set `CF_BEACON_TOKEN`) and allow ~1 week of data. See docs/analytics.md._",
    );
  } else {
    lines.push("");
    lines.push(
      table(
        referrers.map((r) => [r.referrer, String(r.count)]),
        ["Referrer", "Pageloads"],
      ),
    );
  }
  lines.push("");
  lines.push(
    `**Totals across zones:** ${grandPV} page views · ${grandUniq} unique visitors (last ${days}d).`,
  );

  await emit(lines);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
