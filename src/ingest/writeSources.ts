import { mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Source } from "@/pipeline/types";
import type { GarlicArticle } from "@/ingest/types";
import { downloadImage } from "@/ingest/images";

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

export async function writeSourceFiles(opts: {
  articles: GarlicArticle[];
  contentDir: string;
  fetchBytes?: (url: string) => Promise<Uint8Array>;
}): Promise<void> {
  const { articles, contentDir } = opts;
  clearPool(contentDir);

  const counters: Record<Source, number> = { cnn: 0, fox: 0 };
  for (const a of articles) {
    const n = (counters[a.source] += 1);
    const nn = String(n).padStart(2, "0");
    const slug = slugify(a.garlicTitle);
    const basename = `${a.source}-${nn}-${slug}`;

    let image: { src: string; alt: string; caption?: string } | undefined;
    if (a.imageUrl) {
      await downloadImage({
        imageUrl: a.imageUrl,
        destDir: join(contentDir, "img"),
        basename,
        fetchBytes: opts.fetchBytes,
      });
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
