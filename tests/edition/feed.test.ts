import { test, expect } from "bun:test";
import { buildFeed, feedItems, rfc822, plainText, escapeXml } from "@/edition/feed";
import type { Edition } from "@/edition/schema";
import { validEdition } from "../fixtures/valid-edition";

const ORIGIN = "https://www.thegarlictimes.com";

function editionOn(date: string, titles: string[]): Edition {
  return {
    ...validEdition,
    date,
    articles: titles.map((title) => ({
      title,
      body: [`Body of ${title} with a **bold** bit.`],
      size: "md" as const,
      columns: 1 as const,
    })),
  };
}

test("rfc822 renders a deterministic 06:00 GMT timestamp from the date", () => {
  expect(rfc822("2026-07-14")).toBe("Tue, 14 Jul 2026 06:00:00 GMT");
  expect(rfc822("2026-01-01")).toBe("Thu, 01 Jan 2026 06:00:00 GMT");
});

test("plainText strips bold markup and collapses whitespace", () => {
  expect(plainText("a **bold**   lead\nin")).toBe("a bold lead in");
});

test("escapeXml escapes the five XML entities", () => {
  expect(escapeXml(`Tom & "Jerry" <3 O'Brien >`)).toBe(
    "Tom &amp; &quot;Jerry&quot; &lt;3 O&apos;Brien &gt;",
  );
});

test("feedItems yields one item per article, newest edition first", () => {
  const editions = [
    editionOn("2026-06-25", ["Old A", "Old B"]),
    editionOn("2026-06-27", ["New A", "New B"]),
    editionOn("2026-06-26", ["Mid A"]),
  ];
  const items = feedItems(editions, ORIGIN);
  expect(items.map((i) => i.title)).toEqual(["New A", "New B", "Mid A", "Old A", "Old B"]);
  // Article links use the crawlable anchor form, not the /<date>/<n>/ like-stub.
  expect(items[0].link).toBe("https://www.thegarlictimes.com/2026-06-27/#article-1");
  expect(items[1].link).toBe("https://www.thegarlictimes.com/2026-06-27/#article-2");
  expect(items[0].pubDate).toBe("Sat, 27 Jun 2026 06:00:00 GMT");
});

test("feedItems caps the total number of items", () => {
  const editions = Array.from({ length: 30 }, (_, i) =>
    editionOn(`2026-06-${String((i % 28) + 1).padStart(2, "0")}`, ["x", "y", "z"]),
  );
  const items = feedItems(editions, ORIGIN, 40);
  expect(items.length).toBe(40);
});

test("buildFeed emits a well-formed RSS 2.0 document with channel metadata", () => {
  const xml = buildFeed([editionOn("2026-06-27", ["Headline one"])], ORIGIN);
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  expect(xml).toContain('<rss version="2.0"');
  expect(xml).toContain("<title>The Garlic Times</title>");
  expect(xml).toContain(`<link>${ORIGIN}/</link>`);
  expect(xml).toContain(`<atom:link href="${ORIGIN}/rss.xml" rel="self"`);
  expect(xml).toContain("<language>en</language>");
  expect(xml).toContain("<lastBuildDate>Sat, 27 Jun 2026 06:00:00 GMT</lastBuildDate>");
  expect(xml).toContain("<item>");
  expect(xml).toContain("<title>Headline one</title>");
  expect(xml).toContain(`<guid isPermaLink="true">${ORIGIN}/2026-06-27/#article-1</guid>`);
  // Equal open/close tag counts => balanced (cheap well-formedness sanity check).
  for (const tag of ["channel", "item", "title", "link", "guid", "pubDate", "description"]) {
    const open = (xml.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;
    const close = (xml.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
    expect(open).toBe(close);
  }
});

test("buildFeed escapes XML-hostile characters in titles and descriptions", () => {
  const edition = editionOn("2026-06-27", ['Ampersand & <angle> "quote"']);
  const xml = buildFeed([edition], ORIGIN);
  expect(xml).toContain("<title>Ampersand &amp; &lt;angle&gt; &quot;quote&quot;</title>");
  expect(xml).not.toContain("<angle>");
});
