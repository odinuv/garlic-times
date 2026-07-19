import { test, expect } from "bun:test";
import { buildDigest, formatDisplayDate } from "../../scripts/send-newsletter";
import type { GeminiComplete } from "@/ingest/gemini";

test("formatDisplayDate renders a period-style long date", () => {
  expect(formatDisplayDate("2026-07-18")).toBe("Saturday July 18, 2026");
});

test("buildDigest ranks, selects five, and builds a record + email", async () => {
  // Fake ranker: score by article number so output is deterministic.
  const fake: GeminiComplete = async (args) => {
    const ids = [...args.prompt.matchAll(/(\d{4}-\d{2}-\d{2}#\d+)/g)].map((m) => m[1]);
    return JSON.stringify({ scores: ids.map((id, i) => ({ id, score: 100 - i })) });
  };
  const { record, subject, html } = await buildDigest({
    contentDir: "tests/fixtures/newsletter",
    date: "2026-07-18",
    complete: fake,
  });
  expect(record.saturdayDate).toBe("2026-07-18");
  expect(record.quota).toEqual({ cnn: 3, fox: 2 }); // ISO week 29 is odd
  expect(record.picks.length).toBeGreaterThan(0);
  expect(record.candidates.length).toBeGreaterThanOrEqual(record.picks.length);
  expect(subject).toContain("Saturday Special");
  expect(html).toContain("thegarlictimes.com");
});
