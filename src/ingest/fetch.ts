import { XMLParser } from "fast-xml-parser";
import type { FeedItem } from "@/ingest/types";

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
