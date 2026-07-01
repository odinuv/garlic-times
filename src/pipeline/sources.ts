import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Source, SourceStory } from "@/pipeline/types";
import type { EditionImage } from "@/edition/schema";

interface RawStory {
  headline: string;
  body: string[];
  image?: EditionImage;
  sourceUrl?: string;
}

export function loadSourceStories(sourcesDir: string, source: Source): SourceStory[] {
  const dir = join(sourcesDir, source);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.map((f) => {
    const raw = JSON.parse(readFileSync(join(dir, f), "utf8")) as RawStory;
    return {
      source,
      headline: raw.headline,
      body: raw.body,
      image: raw.image,
      sourceUrl: raw.sourceUrl,
    };
  });
}
