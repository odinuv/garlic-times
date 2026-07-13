// tests/ingest/classify.test.ts
import { test, expect } from "bun:test";
import { classifyCandidates } from "@/ingest/classify";
import type { Candidate } from "@/ingest/types";
import type { GeminiComplete } from "@/ingest/gemini";

const cand = (title: string): Candidate => ({
  source: "cnn",
  url: `https://x/${title}`,
  title,
  bodyMarkdown: "body",
});

test("classifyCandidates keeps only eligible candidates", async () => {
  const candidates = [cand("Cabinet talks resume"), cand("Six killed in shooting")];
  const fake: GeminiComplete = async () =>
    JSON.stringify([
      { index: 0, eligible: true, reason: "politics" },
      { index: 1, eligible: false, reason: "shooting" },
    ]);
  const out = await classifyCandidates(candidates, fake);
  expect(out).toHaveLength(1);
  expect(out[0].title).toBe("Cabinet talks resume");
});

test("classifyCandidates returns [] for no candidates without calling the model", async () => {
  let called = false;
  const fake: GeminiComplete = async () => {
    called = true;
    return "[]";
  };
  const out = await classifyCandidates([], fake);
  expect(out).toEqual([]);
  expect(called).toBe(false);
});
