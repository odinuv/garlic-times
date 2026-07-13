import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFeed, cleanTitle, parseNewsSitemap } from "@/ingest/fetch";

const xml = readFileSync(join(import.meta.dir, "..", "fixtures", "ingest", "feed.xml"), "utf8");

test("parseFeed extracts title/url pairs and skips items missing a link", () => {
  const items = parseFeed(xml);
  expect(items).toEqual([
    { title: "First story headline", url: "https://example.com/a" },
    { title: "Second story headline", url: "https://example.com/b" },
  ]);
});

test("parseNewsSitemap extracts loc + news:title pairs", () => {
  const xml = `<?xml version="1.0"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
    <url><loc>https://www.cnn.com/2026/07/03/a</loc><news:news><news:title>First article</news:title></news:news></url>
    <url><loc>https://www.cnn.com/2026/07/03/b</loc><news:news><news:title>Second article</news:title></news:news></url>
  </urlset>`;
  expect(parseNewsSitemap(xml)).toEqual([
    { title: "First article", url: "https://www.cnn.com/2026/07/03/a" },
    { title: "Second article", url: "https://www.cnn.com/2026/07/03/b" },
  ]);
});

test("cleanTitle strips trailing outlet tags but leaves normal titles", () => {
  expect(cleanTitle("Volunteer shares experience on front line | CNN")).toBe(
    "Volunteer shares experience on front line",
  );
  expect(cleanTitle("Haberman reveals why Trump attacked judge | CNN Politics")).toBe(
    "Haberman reveals why Trump attacked judge",
  );
  expect(cleanTitle("Border agents make a seizure - Fox News")).toBe(
    "Border agents make a seizure",
  );
  expect(cleanTitle("A perfectly normal headline")).toBe("A perfectly normal headline");
});
