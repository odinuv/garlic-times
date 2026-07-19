import { test, expect } from "bun:test";
import { rankCandidates, EXEMPLARS, buildRankPrompt } from "@/newsletter/rank";
import type { GeminiComplete } from "@/ingest/gemini";
import type { Candidate } from "@/newsletter/types";

const cands: Candidate[] = [
  {
    id: "2026-07-13#1",
    date: "2026-07-13",
    weekday: "Mon",
    number: 1,
    source: "cnn",
    title: "A",
    url: "u1",
  },
  {
    id: "2026-07-14#1",
    date: "2026-07-14",
    weekday: "Tue",
    number: 1,
    source: "fox",
    title: "B",
    url: "u2",
  },
];

test("buildRankPrompt lists every candidate id and title", () => {
  const p = buildRankPrompt(cands);
  expect(p).toContain("2026-07-13#1");
  expect(p).toContain("2026-07-14#1");
  expect(p).toContain("A");
  expect(p).toContain("B");
});

test("exemplars carry the editor's good and bad sample titles", () => {
  expect(EXEMPLARS).toContain("garden garlic");
  expect(EXEMPLARS).toContain("Wrigley Field garlic");
});

test("rankCandidates attaches parsed scores; missing ids default to 0", async () => {
  const fake: GeminiComplete = async () =>
    JSON.stringify({ scores: [{ id: "2026-07-13#1", score: 88, note: "vivid" }] });
  const scored = await rankCandidates(cands, fake);
  expect(scored.find((s) => s.id === "2026-07-13#1")!.score).toBe(88);
  expect(scored.find((s) => s.id === "2026-07-14#1")!.score).toBe(0);
});

test("rankCandidates returns [] for no candidates without calling the model", async () => {
  let called = false;
  const fake: GeminiComplete = async () => {
    called = true;
    return "{}";
  };
  expect(await rankCandidates([], fake)).toEqual([]);
  expect(called).toBe(false);
});
