// tests/ingest/extract.test.ts
import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractArticle } from "@/ingest/fetch";

const html = readFileSync(join(import.meta.dir, "..", "fixtures", "ingest", "article.html"), "utf8");

test("extractArticle returns title, markdown body, and og:image", () => {
  const out = extractArticle(html, "https://example.com/a");
  expect(out).not.toBeNull();
  expect(out!.title).toContain("cabinet talks");
  expect(out!.bodyMarkdown).toContain("Ministers reassembled");
  expect(out!.bodyMarkdown).toContain("constructive");
  expect(out!.imageUrl).toBe("https://example.com/lead.jpg");
});

test("extractArticle returns null when there is no usable content", () => {
  const out = extractArticle("<html><body></body></html>", "https://example.com/empty");
  expect(out).toBeNull();
});
