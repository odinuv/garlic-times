// tests/ingest/pipeline.test.ts
import { test, expect } from "bun:test";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runIngest } from "@/ingest/pipeline";
import type { GeminiComplete } from "@/ingest/gemini";

const FEED = (s: string) => `<?xml version="1.0"?><rss><channel>
  ${[1, 2, 3].map((n) => `<item><title>${s} ${n}</title><link>https://${s}/${n}</link></item>`).join("")}
</channel></rss>`;
const ARTICLE = (t: string) => `<!doctype html><html><head><title>${t}</title>
  <meta property="og:image" content="https://img/${encodeURIComponent(t)}.jpg"/></head>
  <body><article><h1>${t}</h1>
  <p>${t} body paragraph one with enough words for readability to retain the content here.</p>
  <p>${t} body paragraph two with more sentences so the parser is content with the article.</p>
  </article></body></html>`;

const fetchText = async (url: string) => {
  if (url.includes("rss") || url.includes("xml")) {
    return url.includes("cnn") || url.includes("edition") ? FEED("cnn") : FEED("fox");
  }
  return ARTICLE(url.replace("https://", ""));
};

// The model: mark all 6 eligible, garlic each title, select 3 per source, swap body.
const complete: GeminiComplete = async ({ system }) => {
  if (system.includes("ELIGIBLE")) {
    return JSON.stringify(
      Array.from({ length: 6 }, (_, i) => ({ index: i, eligible: true, reason: "ok" })),
    );
  }
  if (system.includes("joke headline")) {
    return JSON.stringify(
      Array.from({ length: 6 }, (_, i) => ({
        index: i,
        garlicTitle: `garlic ${i}`,
        swappedTerm: "x",
        isMaga: false,
      })),
    );
  }
  if (system.includes("curate")) {
    return JSON.stringify({ cnn: [0, 1, 2], fox: [3, 4, 5] });
  }
  return JSON.stringify({ paragraphs: ["Garlic para one.", "Garlic para two."] });
};

test("runIngest writes >=3 articles per source", async () => {
  const contentDir = mkdtempSync(join(tmpdir(), "gt-pipe-"));
  const res = await runIngest({
    contentDir,
    complete,
    fetchText,
    generateImage: async () => new Uint8Array([9]),
    fetchImageBytes: async () => new Uint8Array([1]),
    perSource: 3,
    minPerSource: 3,
  });
  expect(res.written).toBe(6);
  expect(readdirSync(join(contentDir, "sources", "cnn")).length).toBe(3);
  expect(readdirSync(join(contentDir, "sources", "fox")).length).toBe(3);
  expect(res.selection).toHaveLength(6);
  expect(res.selection.every((s) => s.picked)).toBe(true); // this fixture picks all 6
  expect(res.selection.filter((s) => s.source === "cnn")).toHaveLength(3);
});
