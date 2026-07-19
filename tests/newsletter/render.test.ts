import { test, expect } from "bun:test";
import { renderDigest, subjectFor } from "@/newsletter/render";
import type { Pick } from "@/newsletter/types";

const picks: Pick[] = [
  {
    id: "2026-07-13#1",
    date: "2026-07-13",
    weekday: "Mon",
    number: 1,
    source: "cnn",
    title: "Firing garlic cartoon",
    url: "https://x/2026-07-13/#article-1",
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
    url: "https://x/2026-07-14/#article-1",
    score: 95,
    rank: 2,
  },
];

test("subject teases the highest-scored pick", () => {
  expect(subjectFor(picks)).toBe("The Garlic Times · Saturday Special: Naval garlic hours away");
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

test("text alternative lists each pick as a plain link", () => {
  const { text } = renderDigest(picks, { displayDate: "Saturday July 18, 2026" });
  expect(text).toContain("Naval garlic hours away");
  expect(text).toContain("https://x/2026-07-14/#article-1");
});
