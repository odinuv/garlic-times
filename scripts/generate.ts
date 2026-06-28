// scripts/generate.ts
import React from "react";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { parseEdition, type Edition } from "@/edition/schema";
import { EditionPage } from "@/edition/Edition";
import { renderDocument } from "@/edition/shell";

export function loadEditions(srcDir: string): Edition[] {
  const files = readdirSync(srcDir).filter((f) => f.endsWith(".json"));
  const editions = files.map((f) => parseEdition(JSON.parse(readFileSync(join(srcDir, f), "utf8")), f));
  return editions.sort((a, b) => a.date.localeCompare(b.date));
}

export function neighbours(
  editions: Edition[],
  index: number,
): { prevDate: string | null; nextDate: string | null } {
  return {
    prevDate: index > 0 ? editions[index - 1].date : null,
    nextDate: index < editions.length - 1 ? editions[index + 1].date : null,
  };
}

function writeHtml(outDir: string, segments: string[], html: string) {
  const dir = join(outDir, ...segments);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
}

export async function writePages(opts: {
  editions: Edition[];
  aboutHtml: string;
  outDir: string;
  faviconHref: string;
}): Promise<void> {
  const { editions, aboutHtml, outDir, faviconHref } = opts;
  if (editions.length === 0) throw new Error("No editions found in content/src");

  editions.forEach((edition, i) => {
    const { prevDate, nextDate } = neighbours(editions, i);
    const html = renderDocument({
      title: edition.meta.title,
      description: edition.meta.description,
      faviconHref,
      body: React.createElement(EditionPage, { edition, prevDate, nextDate }),
    });
    writeHtml(outDir, [edition.date], html);
    if (i === editions.length - 1) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "index.html"), html); // root = newest
    }
  });

  const aboutDoc = renderDocument({
    title: "About — The Garlic Times",
    description: "About The Garlic Times.",
    faviconHref,
    body: React.createElement("div", { dangerouslySetInnerHTML: { __html: aboutHtml } }),
  });
  writeHtml(outDir, ["about"], aboutDoc);
}

export function copyAssets(contentDir: string, outDir: string): void {
  for (const sub of ["img", "static"]) {
    const from = join(contentDir, sub);
    if (existsSync(from)) cpSync(from, join(outDir, sub), { recursive: true });
  }
}

export async function compileCss(inputCss: string, outCss: string): Promise<void> {
  const proc = Bun.spawn(["bunx", "@tailwindcss/cli", "-i", inputCss, "-o", outCss, "--minify"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`Tailwind CLI failed with exit code ${code}`);
}

export async function build(opts: { contentDir: string; outDir: string }): Promise<void> {
  const { contentDir, outDir } = opts;
  const editions = loadEditions(join(contentDir, "src"));
  const aboutPath = join(contentDir, "about.html");
  const aboutHtml = existsSync(aboutPath) ? readFileSync(aboutPath, "utf8") : "<section><h1>About</h1></section>";
  await writePages({ editions, aboutHtml, outDir, faviconHref: "/static/coat-of-arms.png" });
  copyAssets(contentDir, outDir);
  await compileCss("src/styles.css", join(outDir, "styles.css"));
}

if (import.meta.main) {
  build({ contentDir: "content", outDir: "dist" })
    .then(() => console.log("Generated dist/"))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
