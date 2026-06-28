// Authoring CLI: assemble one day's edition JSON into content/src/<date>.json.
// (Distinct from scripts/generate.ts, which renders all editions to dist/.)
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildEdition } from "@/pipeline/buildEdition";

export function todayIso(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function authorEdition(opts: { date: string; contentDir: string; outDir?: string }): string {
  const { date, contentDir } = opts;
  const outDir = opts.outDir ?? join(contentDir, "src");
  const edition = buildEdition({ date, contentDir });
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${date}.json`);
  writeFileSync(path, JSON.stringify(edition, null, 2) + "\n");
  return path;
}

if (import.meta.main) {
  const date = Bun.argv[2] ?? todayIso();
  try {
    const path = authorEdition({ date, contentDir: "content" });
    console.log(`Authored ${path}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
