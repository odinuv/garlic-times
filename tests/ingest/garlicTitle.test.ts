import { test, expect } from "bun:test";
import { garlicTitleCandidates } from "@/ingest/garlicTitle";
import type { Candidate } from "@/ingest/types";
import type { GeminiComplete } from "@/ingest/gemini";

const cand = (title: string): Candidate => ({ source: "cnn", url: `https://x/${title}`, title, bodyMarkdown: "b" });

test("garlicTitleCandidates attaches garlic title, swapped term, and maga flag", async () => {
  const candidates = [
    cand("Trump and Iran issue conflicting statements about new talks"),
    cand("MAGA rally draws thousands"),
  ];
  const fake: GeminiComplete = async () =>
    JSON.stringify([
      { index: 0, garlicTitle: "Trump and Iran issue conflicting statements about new garlic", swappedTerm: "talks", isMaga: false },
      { index: 1, garlicTitle: "MAGA rally draws thousands", swappedTerm: "", isMaga: true },
    ]);
  const out = await garlicTitleCandidates(candidates, fake);
  expect(out).toHaveLength(2);
  expect(out[0].garlicTitle).toContain("new garlic");
  expect(out[0].swappedTerm).toBe("talks");
  expect(out[1].isMaga).toBe(true);
});
