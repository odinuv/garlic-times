import { test, expect } from "bun:test";
import { selectBest } from "@/ingest/select";
import type { GarlicTitled } from "@/ingest/types";
import type { Source } from "@/pipeline/types";
import type { GeminiComplete } from "@/ingest/gemini";

const g = (source: Source, n: number): GarlicTitled => ({
  source, url: `https://${source}/${n}`, title: `t${n}`, bodyMarkdown: "b",
  garlicTitle: `${source} garlic ${n}`, swappedTerm: "x", isMaga: false,
});

test("selectBest caps each source to perSource, ordered by model ranking", async () => {
  const candidates = [g("cnn", 0), g("cnn", 1), g("cnn", 2), g("fox", 3), g("fox", 4)];
  const fake: GeminiComplete = async () =>
    JSON.stringify({ cnn: [2, 0, 1], fox: [4, 3] });
  const out = await selectBest(candidates, fake, 2);
  // 2 per source, in the model's order
  expect(out.map((c) => c.url)).toEqual([
    "https://cnn/2", "https://cnn/0", "https://fox/4", "https://fox/3",
  ]);
});
