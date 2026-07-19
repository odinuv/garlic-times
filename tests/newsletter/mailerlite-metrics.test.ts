import { test, expect } from "bun:test";
import {
  createFakeMailerLiteMetricsClient,
  createMailerLiteMetricsClient,
  renderEmailFunnel,
  type MailerLiteMetrics,
} from "@/newsletter/mailerlite-metrics";

// A MailerLite-shaped GET stub: routes on the request path and returns the
// canned JSON body for each endpoint the metrics client touches.
function stubFetch(routes: Record<string, unknown>) {
  const calls: string[] = [];
  const fn = (async (url: string | URL) => {
    const u = String(url);
    calls.push(u);
    const match = Object.keys(routes).find((path) => u.includes(path));
    if (!match) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(routes[match]), { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const GROUPS = {
  data: [
    { id: "g_other", name: "Imports", active_count: 3, unsubscribed_count: 0 },
    { id: "g_news", name: "The Garlic Times", active_count: 42, unsubscribed_count: 5 },
  ],
};

// Two sent campaigns: one inside the 7-day window, one older than it.
const CAMPAIGNS = {
  data: [
    {
      id: "c_recent",
      name: "Saturday Special — Jul 18",
      finished_at: "2026-07-18 08:01:00",
      stats: { sent: 40, opens_count: 20, clicks_count: 8, unsubscribes_count: 1 },
    },
    {
      id: "c_old",
      name: "Saturday Special — Jul 04",
      finished_at: "2026-07-04 08:01:00",
      stats: { sent: 30, opens_count: 15, clicks_count: 4, unsubscribes_count: 0 },
    },
  ],
};

test("fetchMetrics reads the group's subscriber count and windows campaigns", async () => {
  const { fn, calls } = stubFetch({ "/groups": GROUPS, "/campaigns": CAMPAIGNS });
  const client = createMailerLiteMetricsClient("key_abc", fn);
  const m = await client.fetchMetrics({ groupId: "g_news", sinceDate: "2026-07-12", days: 7 });

  // Subscriber count comes from the matching group's active_count.
  expect(m.subscribers).toBe(42);
  expect(m.groupName).toBe("The Garlic Times");

  // Only the campaign sent inside the window is kept.
  expect(m.campaigns.map((c) => c.id)).toEqual(["c_recent"]);
  expect(m.totals).toEqual({
    campaigns: 1,
    recipients: 40,
    opens: 20,
    clicks: 8,
    unsubscribes: 1,
  });

  // Auth header + both endpoints were called.
  expect(calls.some((u) => u.includes("/groups"))).toBe(true);
  expect(calls.some((u) => u.includes("/campaigns"))).toBe(true);
});

test("fetchMetrics without a groupId sums active_count across all groups", async () => {
  const { fn } = stubFetch({ "/groups": GROUPS, "/campaigns": CAMPAIGNS });
  const client = createMailerLiteMetricsClient("key_abc", fn);
  const m = await client.fetchMetrics({ sinceDate: "2026-07-12", days: 7 });
  expect(m.subscribers).toBe(45); // 3 + 42
  expect(m.groupName).toBeNull();
});

test("real client throws with a MailerLite-tagged error on non-2xx", async () => {
  const fn = (async () =>
    new Response(JSON.stringify({ message: "bad key" }), {
      status: 401,
    })) as unknown as typeof fetch;
  const client = createMailerLiteMetricsClient("key_abc", fn);
  await expect(client.fetchMetrics({ sinceDate: "2026-07-12", days: 7 })).rejects.toThrow(
    /MailerLite/,
  );
});

test("fake client returns the injected metrics", async () => {
  const metrics: MailerLiteMetrics = {
    subscribers: 10,
    groupName: "g",
    window: { sinceDate: "2026-07-12", days: 7 },
    campaigns: [],
    totals: { campaigns: 0, recipients: 0, opens: 0, clicks: 0, unsubscribes: 0 },
  };
  const client = createFakeMailerLiteMetricsClient(metrics);
  expect(await client.fetchMetrics({ sinceDate: "2026-07-12", days: 7 })).toEqual(metrics);
});

test("renderEmailFunnel shows subscribers, per-campaign rows, and totals", () => {
  const metrics: MailerLiteMetrics = {
    subscribers: 42,
    groupName: "The Garlic Times",
    window: { sinceDate: "2026-07-12", days: 7 },
    campaigns: [
      {
        id: "c_recent",
        name: "Saturday Special — Jul 18",
        sentAt: "2026-07-18",
        recipients: 40,
        opens: 20,
        clicks: 8,
        unsubscribes: 1,
      },
    ],
    totals: { campaigns: 1, recipients: 40, opens: 20, clicks: 8, unsubscribes: 1 },
  };
  const md = renderEmailFunnel(metrics);
  expect(md).toContain("Email funnel");
  expect(md).toContain("42"); // subscriber count
  expect(md).toContain("The Garlic Times");
  expect(md).toContain("Saturday Special — Jul 18");
  expect(md).toContain("50.0%"); // open rate 20/40
  expect(md).toContain("20.0%"); // click rate 8/40
  expect(md).toContain("Totals");
});

test("renderEmailFunnel handles a window with no campaigns", () => {
  const metrics: MailerLiteMetrics = {
    subscribers: 5,
    groupName: null,
    window: { sinceDate: "2026-07-12", days: 7 },
    campaigns: [],
    totals: { campaigns: 0, recipients: 0, opens: 0, clicks: 0, unsubscribes: 0 },
  };
  const md = renderEmailFunnel(metrics);
  expect(md).toContain("No campaigns sent");
  expect(md).toContain("5"); // subscriber count still shown
});
