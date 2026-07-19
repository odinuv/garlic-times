import { test, expect } from "bun:test";
import { renderDigest } from "@/newsletter/render";
import type { Pick } from "@/newsletter/types";

const picks: Pick[] = [
  {
    id: "2026-07-13#1",
    date: "2026-07-13",
    weekday: "Mon",
    number: 1,
    source: "cnn",
    title: "Firing garlic cartoon",
    url: "https://x/2026-07-13/1/",
    score: 70,
    rank: 1,
  },
  {
    id: "2026-07-14#1",
    date: "2026-07-14",
    weekday: "Tue",
    number: 1,
    source: "fox",
    title: "Naval garlic hours away",
    url: "https://x/2026-07-14/1/",
    score: 95,
    rank: 2,
  },
];

test("subject is the fixed masthead line (no headline teaser)", () => {
  const { subject } = renderDigest(picks, { displayDate: "Saturday July 18, 2026" });
  expect(subject).toBe("The Garlic Times · Saturday Special");
});

test("html contains every pick's link and title, plus the display date", () => {
  const { html } = renderDigest(picks, { displayDate: "Saturday July 18, 2026" });
  for (const p of picks) {
    expect(html).toContain(p.url);
    expect(html).toContain(p.title);
  }
  expect(html).toContain("Saturday July 18, 2026");
  expect(html).toContain("Saturday Special");
});

test("each article has a >> read-more link to its per-article page", () => {
  const { html } = renderDigest(picks, { displayDate: "Saturday July 18, 2026" });
  const readMores = html.match(/&gt;&gt; Read more/g) ?? [];
  expect(readMores).toHaveLength(picks.length);
  for (const p of picks) {
    expect(html).toContain(`href="${p.url}"`);
  }
});

test("does not label the source (Fox/CNN) — only the weekday kicker", () => {
  const { html } = renderDigest(picks, { displayDate: "Saturday July 18, 2026" });
  expect(html).not.toContain("CNN");
  expect(html).not.toContain("Fox");
  expect(html).toContain("Mon");
  expect(html).toContain("Tue");
});
