// tests/ingest/fetchCandidates.test.ts
import { test, expect } from "bun:test";
import { fetchCandidates, type FetchFn } from "@/ingest/fetch";

const FEED_XML = `<?xml version="1.0"?><rss><channel>
  <item><title>Story one</title><link>https://news/1</link></item>
  <item><title>Story two</title><link>https://news/2</link></item>
</channel></rss>`;

const ARTICLE = (n: string) => `<!doctype html><html><head>
  <title>Story ${n}</title><meta property="og:image" content="https://img/${n}.jpg"/>
  </head><body><article><h1>Story ${n}</h1>
  <p>This is the body of story ${n}, long enough for readability to keep it as real content.</p>
  <p>A second paragraph adds more substance so the extractor is satisfied with the article.</p>
  </article></body></html>`;

test("fetchCandidates extracts a Candidate per feed item", async () => {
  const fetchText: FetchFn = async (url) => {
    if (url.endsWith(".rss") || url.includes("feed")) return FEED_XML;
    if (url === "https://news/1") return ARTICLE("1");
    if (url === "https://news/2") return ARTICLE("2");
    return "";
  };
  const out = await fetchCandidates("cnn", { fetchText, perFeed: 10 });
  // Two items across the cnn feeds (deduped by url); each becomes a candidate.
  expect(out.length).toBeGreaterThanOrEqual(2);
  const one = out.find((c) => c.url === "https://news/1");
  expect(one?.source).toBe("cnn");
  expect(one?.title).toContain("Story 1");
  expect(one?.bodyMarkdown).toContain("body of story 1");
  expect(one?.imageUrl).toBe("https://img/1.jpg");
});
