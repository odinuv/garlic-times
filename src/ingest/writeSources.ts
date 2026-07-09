import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Source } from "@/pipeline/types";
import type { GarlicArticle } from "@/ingest/types";

const SOURCES: Source[] = ["cnn", "fox"];

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join("-")
    .replace(/-+/g, "-");
}

function clearPool(contentDir: string, date: string): void {
  for (const source of SOURCES) {
    const dir = join(contentDir, "sources", source);
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) if (f.endsWith(".json")) rmSync(join(dir, f));
    }
  }
  // Restore brings back every prior day's images under content/img/<date>/;
  // only today's dir is transient, so clear just that one (recursively).
  const imgDir = join(contentDir, "img", date);
  if (existsSync(imgDir)) rmSync(imgDir, { recursive: true, force: true });
}

// Writes the assembled articles to content/sources/<source>/NN-slug.json.
// An article's illustration (B&W sketch bytes, set by the illustrate step) is
// written to content/img/<date>/ and referenced; articles without one are text-only.
export function writeSourceFiles(opts: {
  articles: GarlicArticle[];
  contentDir: string;
  date: string;
}): void {
  const { articles, contentDir, date } = opts;
  clearPool(contentDir, date);

  const counters: Record<Source, number> = { cnn: 0, fox: 0 };
  for (const a of articles) {
    const n = (counters[a.source] += 1);
    const nn = String(n).padStart(2, "0");
    const slug = slugify(a.garlicTitle);
    const basename = `${a.source}-${nn}-${slug}`;

    let image: { src: string; alt: string; caption?: string } | undefined;
    if (a.illustration) {
      const imgDir = join(contentDir, "img", date);
      if (!existsSync(imgDir)) mkdirSync(imgDir, { recursive: true });
      writeFileSync(join(imgDir, `${basename}.jpg`), a.illustration);
      if (a.originalImage) writeFileSync(join(imgDir, `${basename}-source.jpg`), a.originalImage);
      image = { src: `/img/${date}/${basename}.jpg`, alt: a.garlicTitle };
    }

    const dir = join(contentDir, "sources", a.source);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const record = {
      headline: a.garlicTitle,
      body: a.body,
      sourceUrl: a.url,
      ...(image ? { image } : {}),
    };
    writeFileSync(join(dir, `${nn}-${slug}.json`), JSON.stringify(record, null, 2) + "\n");
  }
}
