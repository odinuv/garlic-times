import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFeed } from "@/ingest/fetch";

const xml = readFileSync(join(import.meta.dir, "..", "fixtures", "ingest", "feed.xml"), "utf8");

test("parseFeed extracts title/url pairs and skips items missing a link", () => {
  const items = parseFeed(xml);
  expect(items).toEqual([
    { title: "First story headline", url: "https://example.com/a" },
    { title: "Second story headline", url: "https://example.com/b" },
  ]);
});
