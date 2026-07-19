import { test, expect } from "bun:test";
import { buildDigest, formatDisplayDate, alreadySent } from "../../scripts/send-newsletter";
import type { GeminiComplete } from "@/ingest/gemini";
import type { DigestRecord } from "@/newsletter/types";

test("formatDisplayDate renders a period-style long date", () => {
  expect(formatDisplayDate("2026-07-18")).toBe("Saturday July 18, 2026");
});

test("buildDigest ranks, selects five, and builds a record + email", async () => {
  // Fake ranker: score by article number so output is deterministic.
  const fake: GeminiComplete = async (args) => {
    const ids = [...args.prompt.matchAll(/(\d{4}-\d{2}-\d{2}#\d+)/g)].map((m) => m[1]);
    return JSON.stringify({ scores: ids.map((id, i) => ({ id, score: 100 - i })) });
  };
  const { record, subject, html, text } = await buildDigest({
    contentDir: "tests/fixtures/newsletter",
    date: "2026-07-18",
    complete: fake,
  });
  expect(record.saturdayDate).toBe("2026-07-18");
  expect(record.quota).toEqual({ cnn: 3, fox: 2 }); // ISO week 29 is odd
  expect(record.picks).toHaveLength(5);
  expect(record.candidates.length).toBeGreaterThanOrEqual(record.picks.length);
  expect(subject).toContain("Saturday Special");
  expect(html).toContain("thegarlictimes.com");
  expect(typeof text).toBe("string");
  expect(text.length).toBeGreaterThan(0);
});

test("alreadySent: null record is not already sent", () => {
  expect(alreadySent(null, false)).toBe(false);
});

test("alreadySent: record with campaignId is already sent", () => {
  const rec: DigestRecord = {
    saturdayDate: "2026-07-18",
    isoWeek: 29,
    weekIsOdd: true,
    quota: { cnn: 3, fox: 2 },
    window: { monday: "2026-07-13", friday: "2026-07-17" },
    candidates: [],
    picks: [],
    fallbacksApplied: [],
    sentAt: "2026-07-18T10:00:00.000Z",
    campaignId: "abc-123",
  };
  expect(alreadySent(rec, false)).toBe(true);
});

test("alreadySent: record with campaignId but force=true is not skipped", () => {
  const rec: DigestRecord = {
    saturdayDate: "2026-07-18",
    isoWeek: 29,
    weekIsOdd: true,
    quota: { cnn: 3, fox: 2 },
    window: { monday: "2026-07-13", friday: "2026-07-17" },
    candidates: [],
    picks: [],
    fallbacksApplied: [],
    sentAt: "2026-07-18T10:00:00.000Z",
    campaignId: "abc-123",
  };
  expect(alreadySent(rec, true)).toBe(false);
});

test("alreadySent: record with campaignId=null is not already sent", () => {
  const rec: DigestRecord = {
    saturdayDate: "2026-07-18",
    isoWeek: 29,
    weekIsOdd: true,
    quota: { cnn: 3, fox: 2 },
    window: { monday: "2026-07-13", friday: "2026-07-17" },
    candidates: [],
    picks: [],
    fallbacksApplied: [],
    sentAt: "",
    campaignId: null,
  };
  expect(alreadySent(rec, false)).toBe(false);
});
