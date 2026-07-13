// scripts/ingest-news.ts
// Ingestion CLI: fetch live CNN/Fox news, garlic-ify, and write content/sources/.
// Non-deterministic (live network + Gemini). Run by hand; commit the output.
import { runIngest } from "@/ingest/pipeline";
import { createGeminiComplete } from "@/ingest/gemini";
import { createImageGenerator } from "@/ingest/illustrate";
import { todayIso } from "./author-edition";

if (import.meta.main) {
  runIngest({
    contentDir: "content",
    complete: createGeminiComplete(),
    generateImage: createImageGenerator(),
    date: todayIso(),
  })
    .then(({ written }) => console.log(`Ingested ${written} articles into content/sources/`))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
