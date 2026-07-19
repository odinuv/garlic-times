import { test, expect } from "bun:test";
import { selectPicks } from "@/newsletter/select";
import type { ScoredCandidate, Quota } from "@/newsletter/types";
import type { Source } from "@/pipeline/types";
import type { Weekday } from "@/newsletter/types";

const WD: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DATE: Record<Weekday, string> = {
  Mon: "2026-07-13",
  Tue: "2026-07-14",
  Wed: "2026-07-15",
  Thu: "2026-07-16",
  Fri: "2026-07-17",
};

function c(source: Source, weekday: Weekday, number: number, score: number): ScoredCandidate {
  return {
    id: `${DATE[weekday]}#${number}`,
    date: DATE[weekday],
    weekday,
    number,
    source,
    score,
    title: `${source}-${weekday}-${number}`,
    url: `https://x/${DATE[weekday]}/#article-${number}`,
  };
}

test("honors quota and one-per-day; reading order is Mon→Fri", () => {
  // Odd-week quota: 3 cnn / 2 fox. One strong article per source per day.
  const scored: ScoredCandidate[] = [
    c("fox", "Mon", 1, 50),
    c("cnn", "Mon", 2, 90),
    c("fox", "Tue", 1, 95),
    c("cnn", "Tue", 2, 40),
    c("fox", "Wed", 1, 30),
    c("cnn", "Wed", 2, 85),
    c("fox", "Thu", 1, 20),
    c("cnn", "Thu", 2, 80),
    c("fox", "Fri", 1, 70),
    c("cnn", "Fri", 2, 25),
  ];
  const quota: Quota = { cnn: 3, fox: 2 };
  const { picks, fallbacksApplied } = selectPicks(scored, quota);
  expect(picks).toHaveLength(5);
  expect(fallbacksApplied).toEqual([]);
  // exactly one pick per weekday (global one-per-day)
  expect(new Set(picks.map((p) => p.date)).size).toBe(5);
  // quota respected
  expect(picks.filter((p) => p.source === "fox")).toHaveLength(2);
  expect(picks.filter((p) => p.source === "cnn")).toHaveLength(3);
  // fox (minority) picks its two best days first: Tue(95), Fri(70)
  const foxDays = picks
    .filter((p) => p.source === "fox")
    .map((p) => p.weekday)
    .sort();
  expect(foxDays).toEqual(["Fri", "Tue"]);
  // reading order Mon→Fri
  expect(picks.map((p) => p.rank)).toEqual([1, 2, 3, 4, 5]);
  expect(picks.map((p) => p.weekday)).toEqual(WD);
});

test("relaxes one-per-day when a source lacks enough distinct days", () => {
  // fox needs 2 but only has articles on Tue; cnn plentiful.
  const scored: ScoredCandidate[] = [
    c("fox", "Tue", 1, 95),
    c("fox", "Tue", 2, 90),
    c("cnn", "Mon", 1, 80),
    c("cnn", "Wed", 1, 70),
    c("cnn", "Thu", 1, 60),
  ];
  const { picks, fallbacksApplied } = selectPicks(scored, { cnn: 3, fox: 2 });
  expect(picks).toHaveLength(5);
  expect(picks.filter((p) => p.source === "fox")).toHaveLength(2);
  expect(fallbacksApplied.some((f) => /relaxed/.test(f))).toBe(true);
});

test("borrows from the other source when one source is exhausted", () => {
  // fox has only 1 article total but quota wants 2 -> borrow 1 cnn.
  const scored: ScoredCandidate[] = [
    c("fox", "Tue", 1, 95),
    c("cnn", "Mon", 1, 80),
    c("cnn", "Wed", 1, 70),
    c("cnn", "Thu", 1, 60),
    c("cnn", "Fri", 1, 50),
  ];
  const { picks, fallbacksApplied } = selectPicks(scored, { cnn: 3, fox: 2 });
  expect(picks).toHaveLength(5);
  expect(picks.filter((p) => p.source === "cnn")).toHaveLength(4);
  expect(fallbacksApplied.some((f) => /borrow/.test(f))).toBe(true);
});

test("sends fewer than five when the pool is too small", () => {
  const scored: ScoredCandidate[] = [c("cnn", "Mon", 1, 80), c("fox", "Tue", 1, 70)];
  const { picks } = selectPicks(scored, { cnn: 3, fox: 2 });
  expect(picks).toHaveLength(2);
  expect(picks.map((p) => p.rank)).toEqual([1, 2]);
});

test("returns empty for an empty pool", () => {
  expect(selectPicks([], { cnn: 3, fox: 2 }).picks).toEqual([]);
});

test("fires both relax-day and borrow-source fallbacks in a single run", () => {
  // fox (minority, quota 2) only on Tue; cnn (quota 3) only on Mon, Wed.
  // Phase 1: fox takes Tue (1 pick), cnn takes Mon, Wed (2 picks) = 3 picks
  // Phase 2: fox needs 1 more but only has Tue -> relax, take Tue#2 = 4 picks
  // Phase 3: cnn needs 1 more but only has 2 distinct articles, no relax available
  //          -> borrow from remaining (fox Tue#3 or other) = 5 picks
  const scored: ScoredCandidate[] = [
    c("fox", "Tue", 1, 95),
    c("fox", "Tue", 2, 60),
    c("fox", "Tue", 3, 55),
    c("cnn", "Mon", 1, 80),
    c("cnn", "Wed", 1, 70),
  ];
  const { picks, fallbacksApplied } = selectPicks(scored, { cnn: 3, fox: 2 });
  expect(picks).toHaveLength(5);
  expect(fallbacksApplied.some((f) => /relaxed/.test(f))).toBe(true);
  expect(fallbacksApplied.some((f) => /borrowed/.test(f))).toBe(true);
});
