import { test, expect } from "bun:test";
import { garlicTitleCandidates } from "@/ingest/garlicTitle";
import type { Candidate } from "@/ingest/types";
import type { GeminiComplete } from "@/ingest/gemini";

const cand = (title: string): Candidate => ({
  source: "cnn",
  url: `https://x/${title}`,
  title,
  bodyMarkdown: "b",
});

test("garlicTitleCandidates attaches garlic title, swapped term, and maga flag", async () => {
  const candidates = [
    cand("Trump and Iran issue conflicting statements about new talks"),
    cand("MAGA rally draws thousands"),
  ];
  const fake: GeminiComplete = async () =>
    JSON.stringify([
      {
        index: 0,
        garlicTitle: "Trump and Iran issue conflicting statements about new garlic",
        swappedTerm: "talks",
        isMaga: false,
      },
      { index: 1, garlicTitle: "MAGA rally draws thousands", swappedTerm: "", isMaga: true },
    ]);
  const out = await garlicTitleCandidates(candidates, fake);
  expect(out).toHaveLength(2);
  expect(out[0].garlicTitle).toContain("new garlic");
  expect(out[0].swappedTerm).toBe("talks");
  expect(out[1].isMaga).toBe(true);
});

test("garlicTitleCandidates drops failed swaps (no 'garlic', non-MAGA) but keeps MAGA", async () => {
  const candidates = [
    cand("A story that keeps its garlic word"),
    cand("A story left unchanged by the model"),
    cand("MAGA rally draws thousands"),
  ];
  const fake: GeminiComplete = async () =>
    JSON.stringify([
      {
        index: 0,
        garlicTitle: "A story that keeps its garlic word",
        swappedTerm: "topic",
        isMaga: false,
      },
      {
        index: 1,
        garlicTitle: "A story left unchanged by the model",
        swappedTerm: "",
        isMaga: false,
      },
      { index: 2, garlicTitle: "MAGA rally draws thousands", swappedTerm: "", isMaga: true },
    ]);
  const out = await garlicTitleCandidates(candidates, fake);
  // index 1 dropped (no "garlic", not MAGA); index 0 kept (has garlic); index 2 kept (MAGA)
  expect(out.map((c) => c.title)).toEqual([
    "A story that keeps its garlic word",
    "MAGA rally draws thousands",
  ]);
});
