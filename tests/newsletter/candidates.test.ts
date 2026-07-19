import { test, expect } from "bun:test";
import { loadWeekCandidates, resolveSource } from "@/newsletter/candidates";
import type { Article } from "@/edition/schema";

const DIR = "tests/fixtures/newsletter";

test("loads Mon–Fri candidates, skipping the missing Friday edition", () => {
  const c = loadWeekCandidates(DIR, "2026-07-18"); // Saturday of that ISO week
  const dates = new Set(c.map((x) => x.date));
  expect(dates.has("2026-07-13")).toBe(true);
  expect(dates.has("2026-07-17")).toBe(false); // no file -> skipped, no throw
  expect(c.length).toBeGreaterThanOrEqual(7);
});

test("maps id, weekday, number, source and an absolute per-article url", () => {
  const c = loadWeekCandidates(DIR, "2026-07-18");
  const first = c.find((x) => x.id === "2026-07-13#1")!;
  expect(first.weekday).toBe("Mon");
  expect(first.number).toBe(1);
  expect(first.source).toBe("cnn");
  // per-article permalink (the "like page"), not the edition anchor
  expect(first.url).toBe("https://www.thegarlictimes.com/2026-07-13/1/");
  expect(first.dek).toBe("Mon cnn one.");
});

test("resolveSource falls back to the sourceUrl domain when the field is absent", () => {
  const a = { title: "x", body: ["b"], sourceUrl: "https://www.cnn.com/y" } as Article;
  expect(resolveSource(a, 0, "2026-07-13")).toBe("cnn");
});

test("resolveSource falls back to slot parity when field and url are absent", () => {
  const a = { title: "x", body: ["b"] } as Article;
  // 2026-07-13 is even day-of-year -> assignSlots order [cnn,fox,cnn,cnn,fox].
  expect(resolveSource(a, 0, "2026-07-13")).toBe("cnn");
  expect(resolveSource(a, 1, "2026-07-13")).toBe("fox");
});
