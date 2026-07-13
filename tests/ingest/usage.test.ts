import { test, expect } from "bun:test";
import {
  UsageTracker,
  costFor,
  formatUsageTable,
  formatSelection,
  formatTiming,
  type SelectionEntry,
} from "@/ingest/usage";

test("UsageTracker aggregates calls and tokens per stage+model", () => {
  const t = new UsageTracker();
  t.record("classify", "gemini-2.5-flash", 1000, 100);
  t.record("body-swap", "gemini-2.5-flash-lite", 500, 50);
  t.record("body-swap", "gemini-2.5-flash-lite", 700, 70);
  const rows = t.rows();
  expect(rows).toHaveLength(2);
  const body = rows.find((r) => r.stage === "body-swap")!;
  expect(body.calls).toBe(2);
  expect(body.inputTokens).toBe(1200);
  expect(body.outputTokens).toBe(120);
});

test("costFor uses the price table and returns null for unknown models", () => {
  // 1,000,000 input @ $0.30 + 1,000,000 output @ $2.50 = $2.80
  expect(costFor("gemini-2.5-flash", 1_000_000, 1_000_000)).toBeCloseTo(2.8, 6);
  expect(costFor("some-unknown-model", 1000, 1000)).toBeNull();
});

test("formatUsageTable includes stages, a total, and a dollar cost", () => {
  const t = new UsageTracker();
  t.record("classify", "gemini-2.5-flash", 1000, 100);
  const table = formatUsageTable(t);
  expect(table).toContain("classify");
  expect(table).toContain("gemini-2.5-flash");
  expect(table).toContain("Total");
  expect(table).toContain("$");
});

test("formatUsageTable prices image models per image, not per token", () => {
  const t = new UsageTracker();
  t.record("illustrate", "gemini-3.1-flash-image-preview", 300, 1120);
  t.record("illustrate", "gemini-3.1-flash-image-preview", 300, 1120);
  const table = formatUsageTable(t);
  expect(table).toContain("illustrate");
  // 2 images * $0.067 = $0.134
  expect(table).toContain("$0.1340");
});

test("formatTiming lists each step and a summed total in seconds", () => {
  const out = formatTiming([
    { name: "ingest", ms: 5000 },
    { name: "author", ms: 200 },
  ]);
  expect(out).toContain("ingest");
  expect(out).toContain("5.0s");
  expect(out).toContain("total");
  expect(out).toContain("5.2s");
});

test("formatSelection groups by source and marks picked titles with a star", () => {
  const entries: SelectionEntry[] = [
    { source: "cnn", garlicTitle: "Garlic A", picked: true },
    { source: "cnn", garlicTitle: "Garlic B", picked: false },
    { source: "fox", garlicTitle: "Garlic C", picked: true },
  ];
  const out = formatSelection(entries);
  expect(out).toContain("CNN — 2 candidates, 1 picked");
  expect(out).toContain("★ Garlic A");
  expect(out).toContain("Garlic B");
  expect(out).toContain("FOX — 1 candidates, 1 picked");
  // the unpicked one has no star before it
  expect(out).not.toContain("★ Garlic B");
});
