import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { slugify, writeSourceFiles } from "@/ingest/writeSources";
import type { GarlicArticle } from "@/ingest/types";

test("slugify produces a hyphenated lowercase slug", () => {
  expect(slugify("Garlic is burning, but don't expect Putin to blink")).toBe(
    "garlic-is-burning-but-dont-expect",
  );
});

const article = (n: number, illustrated: boolean): GarlicArticle => ({
  source: "cnn",
  url: `https://cnn/${n}`,
  title: `Title ${n}`,
  bodyMarkdown: "b",
  garlicTitle: `Garlic story ${n}`,
  swappedTerm: "x",
  isMaga: false,
  body: ["Para one.", "Para two."],
  ...(illustrated
    ? { illustration: new Uint8Array([9, 9]), originalImage: new Uint8Array([1, 1]) }
    : {}),
});

test("writeSourceFiles writes NN-slug.json and the date-namespaced image when present", () => {
  const contentDir = mkdtempSync(join(tmpdir(), "gt-src-"));
  const date = "2026-07-01";
  writeSourceFiles({ articles: [article(1, true), article(2, false)], contentDir, date });

  const cnnDir = join(contentDir, "sources", "cnn");
  const files = readdirSync(cnnDir).sort();
  expect(files).toEqual(["01-garlic-story-1.json", "02-garlic-story-2.json"]);

  const first = JSON.parse(readFileSync(join(cnnDir, files[0]), "utf8"));
  expect(first.headline).toBe("Garlic story 1");
  expect(first.body).toEqual(["Para one.", "Para two."]);
  expect(first.image.src).toBe("/img/2026-07-01/cnn-01-garlic-story-1.jpg");
  expect(first.sourceUrl).toBe("https://cnn/1");
  expect(existsSync(join(contentDir, "img", date, "cnn-01-garlic-story-1.jpg"))).toBe(true);
  expect(existsSync(join(contentDir, "img", date, "cnn-01-garlic-story-1-source.jpg"))).toBe(true);

  const second = JSON.parse(readFileSync(join(cnnDir, files[1]), "utf8"));
  expect(second.image).toBeUndefined();
  expect(existsSync(join(contentDir, "img", date, "cnn-02-garlic-story-2.jpg"))).toBe(false);
});
