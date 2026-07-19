// Weekly owned-audience metrics for The Garlic Times.
//
// GAR-9: pull the MailerLite subscriber count + sent-campaign stats (sends,
// opens, clicks, unsubscribes) so the email funnel lands next to the web-traffic
// baseline in the same weekly report (scripts/analytics-report.ts). This is the
// read-only counterpart to mailerlite.ts, which POSTs to send the Saturday
// campaign — kept separate so the send seam stays untouched.
//
// API: https://developers.mailerlite.com/docs (connect.mailerlite.com/api v1).
//   Subscriber count: GET /groups        -> group.active_count
//   Campaign stats:   GET /campaigns?filter[status]=sent -> campaign.stats.*

const API = "https://connect.mailerlite.com/api";

// One sent campaign's headline numbers, already narrowed to the report window.
export interface CampaignStats {
  id: string;
  name: string;
  sentAt: string | null; // ISO date (YYYY-MM-DD) the campaign finished/was sent
  recipients: number; // stats.sent
  opens: number; // stats.opens_count
  clicks: number; // stats.clicks_count
  unsubscribes: number; // stats.unsubscribes_count
}

// The email funnel for one weekly report window. Rates are derived at render
// time from these raw counts, so we never depend on MailerLite's rate shape.
export interface MailerLiteMetrics {
  subscribers: number; // owned audience: group active_count (or account-wide sum)
  groupName: string | null; // group the count came from; null = summed all groups
  window: { sinceDate: string; days: number };
  campaigns: CampaignStats[]; // sent within the window, newest first
  totals: {
    campaigns: number;
    recipients: number;
    opens: number;
    clicks: number;
    unsubscribes: number;
  };
}

export interface MailerLiteMetricsClient {
  fetchMetrics(opts: {
    groupId?: string;
    sinceDate: string; // inclusive lower bound, YYYY-MM-DD
    days: number;
  }): Promise<MailerLiteMetrics>;
}

// Loose shapes for the two GET surfaces this reads; only the fields we use are
// modelled — the API returns much more.
type RawGroup = { id?: string | number; name?: string; active_count?: number };
type RawCampaign = {
  id?: string | number;
  name?: string;
  finished_at?: string | null;
  scheduled_for?: string | null;
  started_at?: string | null;
  created_at?: string | null;
  stats?: {
    sent?: number;
    opens_count?: number;
    clicks_count?: number;
    unsubscribes_count?: number;
  };
};
type ListResponse<T> = { data?: T[]; message?: string; error?: string };

// MailerLite timestamps look like "2026-07-18 08:01:00" (UTC) or ISO. We only
// need the calendar date, and ISO date strings compare correctly as plain
// strings, so slice to YYYY-MM-DD.
function toDate(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = ts.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

// A campaign's effective send date: the first of the lifecycle timestamps that
// is actually populated, newest-intent first.
function campaignSentDate(c: RawCampaign): string | null {
  return (
    toDate(c.finished_at) ?? toDate(c.scheduled_for) ?? toDate(c.started_at) ?? toDate(c.created_at)
  );
}

export function createMailerLiteMetricsClient(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): MailerLiteMetricsClient {
  async function get<T>(path: string): Promise<ListResponse<T>> {
    const res = await fetchImpl(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    const json = (await res.json().catch(() => ({}))) as ListResponse<T>;
    if (!res.ok) {
      throw new Error(
        `MailerLite ${path} failed (${res.status}): ${json.message ?? json.error ?? res.statusText}`,
      );
    }
    return json;
  }

  return {
    async fetchMetrics({ groupId, sinceDate, days }) {
      const [groupsRes, campaignsRes] = await Promise.all([
        get<RawGroup>("/groups?limit=100"),
        // Regular campaigns only — RSS/automation don't belong in a weekly
        // funnel. limit=100 covers a young paper's entire sent history.
        get<RawCampaign>("/campaigns?filter[status]=sent&filter[type]=regular&limit=100"),
      ]);

      const groups = groupsRes.data ?? [];
      let subscribers = 0;
      let groupName: string | null = null;
      if (groupId) {
        const g = groups.find((x) => String(x.id) === String(groupId));
        subscribers = g?.active_count ?? 0;
        groupName = g?.name ?? null;
      } else {
        subscribers = groups.reduce((sum, g) => sum + (g.active_count ?? 0), 0);
      }

      const campaigns: CampaignStats[] = (campaignsRes.data ?? [])
        .map((c) => ({
          id: String(c.id ?? ""),
          name: c.name ?? "(untitled)",
          sentAt: campaignSentDate(c),
          recipients: c.stats?.sent ?? 0,
          opens: c.stats?.opens_count ?? 0,
          clicks: c.stats?.clicks_count ?? 0,
          unsubscribes: c.stats?.unsubscribes_count ?? 0,
        }))
        .filter((c) => c.sentAt !== null && c.sentAt >= sinceDate)
        .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));

      const totals = campaigns.reduce(
        (acc, c) => ({
          campaigns: acc.campaigns + 1,
          recipients: acc.recipients + c.recipients,
          opens: acc.opens + c.opens,
          clicks: acc.clicks + c.clicks,
          unsubscribes: acc.unsubscribes + c.unsubscribes,
        }),
        { campaigns: 0, recipients: 0, opens: 0, clicks: 0, unsubscribes: 0 },
      );

      return { subscribers, groupName, window: { sinceDate, days }, campaigns, totals };
    },
  };
}

export function createFakeMailerLiteMetricsClient(
  metrics: MailerLiteMetrics,
): MailerLiteMetricsClient {
  return {
    async fetchMetrics() {
      return metrics;
    },
  };
}

// Percentage of `n` over `d`, one decimal place, "—" when there were no
// recipients (avoids a division-by-zero "NaN%").
function rate(n: number, d: number): string {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—";
}

// Render the email funnel as a markdown section appended to the weekly traffic
// report, so one read covers web acquisition + email retention. Pure and
// exported for tests.
export function renderEmailFunnel(m: MailerLiteMetrics): string {
  const lines: string[] = [];
  lines.push(`### Email funnel — owned audience (last ${m.window.days}d)`);
  lines.push("");
  lines.push(
    "_Source: MailerLite (connect.mailerlite.com). Generated by `scripts/analytics-report.ts` " +
      "via `src/newsletter/mailerlite-metrics.ts`._",
  );
  lines.push("");
  const label = m.groupName ? `group “${m.groupName}”` : "all groups";
  lines.push(`**Subscribers (${label}):** ${m.subscribers}`);
  lines.push("");

  const header = "| Campaign | Sent | Recipients | Opens | Clicks | Unsubs |";
  const sep = "| --- | --- | --- | --- | --- | --- |";
  if (m.campaigns.length === 0) {
    lines.push(header);
    lines.push(sep);
    lines.push(`| _No campaigns sent in this window_ | — | — | — | — | — |`);
  } else {
    const rows = m.campaigns.map(
      (c) =>
        `| ${c.name} | ${c.sentAt ?? "—"} | ${c.recipients} | ${c.opens} (${rate(
          c.opens,
          c.recipients,
        )}) | ${c.clicks} (${rate(c.clicks, c.recipients)}) | ${c.unsubscribes} |`,
    );
    const t = m.totals;
    const totalRow =
      `| **Totals (${t.campaigns} campaign${t.campaigns === 1 ? "" : "s"})** | | ${t.recipients} | ` +
      `${t.opens} (${rate(t.opens, t.recipients)}) | ${t.clicks} (${rate(t.clicks, t.recipients)}) | ${t.unsubscribes} |`;
    lines.push(header, sep, ...rows, totalRow);
  }
  lines.push("");
  lines.push(
    "_Opens/clicks shown as count (rate over recipients). Subscribers is the current owned-audience size; " +
      "campaign stats cover only sends inside the report window._",
  );
  return lines.join("\n");
}
