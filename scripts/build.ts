// scripts/build.ts
// One-shot pipeline: ingest live news → author today's edition → generate dist/,
// then report Gemini token usage/cost and the candidate-vs-picked garlic titles.
// Non-deterministic (live network + Gemini). Needs GEMINI_API_KEY in .env.
import { runIngest } from "@/ingest/pipeline";
import { createGeminiComplete } from "@/ingest/gemini";
import { createImageGenerator } from "@/ingest/illustrate";
import { UsageTracker, formatUsageTable, formatSelection, formatTiming } from "@/ingest/usage";
import { authorEdition, todayIso } from "./author-edition";
import { build as generateSite } from "./generate";

async function main(): Promise<void> {
  const tracker = new UsageTracker();
  const complete = createGeminiComplete(undefined, tracker);
  const generateImage = createImageGenerator(undefined, tracker);

  const date = todayIso();

  const { written, selection, timings } = await runIngest({
    contentDir: "content",
    complete,
    generateImage,
    date,
  });
  console.log(`Ingested ${written} articles into content/sources/`);

  const tAuthorStart = performance.now();
  const path = authorEdition({ date, contentDir: "content" });
  console.log(`Authored ${path}`);

  const tGenStart = performance.now();
  await generateSite({ contentDir: "content", outDir: "dist" });
  console.log("Generated dist/");
  const tEnd = performance.now();

  console.log("\n" + formatUsageTable(tracker));
  console.log("\n" + formatSelection(selection));
  console.log(
    "\n" +
      formatTiming([
        ...timings, // ingest sub-stages (fetch, classify, …, illustrate, write)
        { name: "author", ms: tGenStart - tAuthorStart },
        { name: "generate", ms: tEnd - tGenStart },
      ]),
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
