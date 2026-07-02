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

function clearPool(contentDir: string): void {
  for (const source of SOURCES) {
    const dir = join(contentDir, "sources", source);
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) if (f.endsWith(".json")) rmSync(join(dir, f));
    }
  }
  const imgDir = join(contentDir, "img");
  if (existsSync(imgDir)) {
    for (const f of readdirSync(imgDir)) {
      if (/^(cnn|fox)-\d{2}-.*\.jpg$/.test(f)) rmSync(join(imgDir, f));
    }
  }
}

// Writes the assembled articles to content/sources/<source>/NN-slug.json.
// An article's illustration (B&W sketch bytes, set by the illustrate step) is
// written to content/img/ and referenced; articles without one are text-only.
export function writeSourceFiles(opts: { articles: GarlicArticle[]; contentDir: string }): void {
  const { articles, contentDir } = opts;
  clearPool(contentDir);

  const counters: Record<Source, number> = { cnn: 0, fox: 0 };
  for (const a of articles) {
    const n = (counters[a.source] += 1);
    const nn = String(n).padStart(2, "0");
    const slug = slugify(a.garlicTitle);
    const basename = `${a.source}-${nn}-${slug}`;

    let image: { src: string; alt: string; caption?: string } | undefined;
    if (a.illustration) {
      const imgDir = join(contentDir, "img");
      if (!existsSync(imgDir)) mkdirSync(imgDir, { recursive: true });
      writeFileSync(join(imgDir, `${basename}.jpg`), a.illustration);
      // Keep the source photo alongside the sketch as an audit trail of what
      // was drawn from what (same prefix; both gitignored + cleared each run).
      if (a.originalImage) writeFileSync(join(imgDir, `${basename}-source.jpg`), a.originalImage);
      image = { src: `/img/${basename}.jpg`, alt: a.garlicTitle };
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
