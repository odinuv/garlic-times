import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slugify, writeSourceFiles } from "@/ingest/writeSources";
import type { GarlicArticle } from "@/ingest/types";

test("slugify produces a hyphenated lowercase slug", () => {
  expect(slugify("Garlic is burning, but don't expect Putin to blink")).toBe(
    "garlic-is-burning-but-dont-expect"
  );
});

const article = (n: number, hasImage: boolean): GarlicArticle => ({
  source: "cnn",
  url: `https://cnn/${n}`,
  title: `Title ${n}`,
  bodyMarkdown: "b",
  garlicTitle: `Garlic story ${n}`,
  swappedTerm: "x",
  isMaga: false,
  body: ["Para one.", "Para two."],
  ...(hasImage ? { imageUrl: `https://img/${n}.jpg` } : {}),
});

test("writeSourceFiles writes NN-slug.json with headline/body/image", async () => {
  const contentDir = mkdtempSync(join(tmpdir(), "gt-src-"));
  await writeSourceFiles({
    articles: [article(1, true), article(2, false)],
    contentDir,
    fetchBytes: async () => new Uint8Array([9, 9]),
  });

  const cnnDir = join(contentDir, "sources", "cnn");
  const files = readdirSync(cnnDir).sort();
  expect(files).toEqual(["01-garlic-story-1.json", "02-garlic-story-2.json"]);

  const first = JSON.parse(readFileSync(join(cnnDir, files[0]), "utf8"));
  expect(first.headline).toBe("Garlic story 1");
  expect(first.body).toEqual(["Para one.", "Para two."]);
  expect(first.image.src).toBe("/img/cnn-01-garlic-story-1.jpg");
  expect(existsSync(join(contentDir, "img", "cnn-01-garlic-story-1.jpg"))).toBe(
    true
  );

  const second = JSON.parse(readFileSync(join(cnnDir, files[1]), "utf8"));
  expect(second.image).toBeUndefined();
});
