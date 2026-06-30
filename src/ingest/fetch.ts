import { XMLParser } from "fast-xml-parser";
import type { FeedItem } from "@/ingest/types";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";

const parser = new XMLParser();

export function parseFeed(xml: string): FeedItem[] {
  const doc = parser.parse(xml);
  const rawItems = doc?.rss?.channel?.item ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  return items
    .map((it: { title?: unknown; link?: unknown }) => ({
      title: typeof it.title === "string" ? it.title.trim() : "",
      url: typeof it.link === "string" ? it.link.trim() : "",
    }))
    .filter((it: FeedItem) => it.title !== "" && it.url !== "");
}

const turndown = new TurndownService({ headingStyle: "atx" });

export function extractArticle(
  html: string,
  url: string,
): { title: string; bodyMarkdown: string; imageUrl?: string } | null {
  const { document } = parseHTML(html);

  const ogImage = document
    .querySelector('meta[property="og:image"]')
    ?.getAttribute("content")
    ?.trim();

  // Readability mutates the document, so read og:image first (above).
  const article = new Readability(document as unknown as Document).parse();
  if (!article || !article.content) return null;

  const bodyMarkdown = turndown.turndown(article.content).trim();
  if (bodyMarkdown.length === 0) return null;

  const title = (article.title ?? document.title ?? "").trim();
  return { title, bodyMarkdown, imageUrl: ogImage || undefined };
}
