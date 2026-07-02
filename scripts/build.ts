// scripts/build.ts
// One-shot pipeline: ingest live news → author today's edition → generate dist/,
// then report Gemini token usage/cost and the candidate-vs-picked garlic titles.
// Non-deterministic (live network + Gemini). Needs GEMINI_API_KEY in .env.
import { runIngest } from "@/ingest/pipeline";
import { createGeminiComplete } from "@/ingest/gemini";
import { createImageGenerator } from "@/ingest/illustrate";
import { UsageTracker, formatUsageTable, formatSelection } from "@/ingest/usage";
import { authorEdition, todayIso } from "./author-edition";
import { build as generateSite } from "./generate";

async function main(): Promise<void> {
  const tracker = new UsageTracker();
  const complete = createGeminiComplete(undefined, tracker);
  const generateImage = createImageGenerator(undefined, tracker);

  const { written, selection } = await runIngest({
    contentDir: "content",
    complete,
    generateImage,
  });
  console.log(`Ingested ${written} articles into content/sources/`);

  const date = todayIso();
  const path = authorEdition({ date, contentDir: "content" });
  console.log(`Authored ${path}`);

  await generateSite({ contentDir: "content", outDir: "dist" });
  console.log("Generated dist/");

  console.log("\n" + formatUsageTable(tracker));
  console.log("\n" + formatSelection(selection));
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
