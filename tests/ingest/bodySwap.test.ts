import { test, expect } from "bun:test";
import { swapBody } from "@/ingest/bodySwap";
import type { GarlicTitled } from "@/ingest/types";
import type { GeminiComplete } from "@/ingest/gemini";

const candidate: GarlicTitled = {
  source: "cnn", url: "https://x/1", title: "Russia is burning", bodyMarkdown: "Russia is burning today. Officials in Russia spoke.",
  garlicTitle: "Garlic is burning", swappedTerm: "Russia", isMaga: false,
};

test("swapBody returns a paragraph array body", async () => {
  const fake: GeminiComplete = async () =>
    JSON.stringify({ paragraphs: ["Garlic is burning today.", "Officials in Garlic spoke."] });
  const out = await swapBody(candidate, fake);
  expect(out.body).toEqual(["Garlic is burning today.", "Officials in Garlic spoke."]);
  expect(out.garlicTitle).toBe("Garlic is burning");
});
