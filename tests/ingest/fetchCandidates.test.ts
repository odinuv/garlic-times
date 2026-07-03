// tests/ingest/fetchCandidates.test.ts
import { test, expect } from "bun:test";
import { fetchCandidates, type FetchFn } from "@/ingest/fetch";

// CNN uses a Google-News sitemap (fresh, direct article URLs).
const SITEMAP_XML = `<?xml version="1.0"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url><loc>https://news/1</loc><news:news><news:title>Story one</news:title></news:news></url>
  <url><loc>https://news/2</loc><news:news><news:title>Story two</news:title></news:news></url>
</urlset>`;

const ARTICLE = (n: string) => `<!doctype html><html><head>
  <title>Story ${n}</title><meta property="og:image" content="https://img/${n}.jpg"/>
  </head><body><article><h1>Story ${n}</h1>
  <p>This is the body of story ${n}, long enough for readability to keep it as real content.</p>
  <p>A second paragraph adds more substance so the extractor is satisfied with the article.</p>
  </article></body></html>`;

test("fetchCandidates extracts a Candidate per sitemap entry", async () => {
  const fetchText: FetchFn = async (url) => {
    if (url.includes("sitemap")) return SITEMAP_XML;
    if (url === "https://news/1") return ARTICLE("1");
    if (url === "https://news/2") return ARTICLE("2");
    return "";
  };
  const out = await fetchCandidates("cnn", { fetchText, perFeed: 10 });
  // Two items in the cnn sitemap; each becomes a candidate.
  expect(out.length).toBeGreaterThanOrEqual(2);
  const one = out.find((c) => c.url === "https://news/1");
  expect(one?.source).toBe("cnn");
  expect(one?.title).toContain("Story 1");
  expect(one?.bodyMarkdown).toContain("body of story 1");
  expect(one?.imageUrl).toBe("https://img/1.jpg");
});
