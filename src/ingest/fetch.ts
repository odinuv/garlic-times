import { XMLParser } from "fast-xml-parser";
import type { FeedItem, Candidate } from "@/ingest/types";
import type { Source } from "@/pipeline/types";
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

// RSS feeds per source. Verify these resolve at implementation time (Step 5);
// kept here as the single place to adjust feed URLs.
export const FEEDS: Record<Source, string[]> = {
  cnn: ["http://rss.cnn.com/rss/edition.rss", "http://rss.cnn.com/rss/edition_world.rss"],
  fox: [
    "https://moxie.foxnews.com/google-publisher/latest.xml",
    "https://moxie.foxnews.com/google-publisher/politics.xml",
  ],
};

export type FetchFn = (url: string) => Promise<string>;

const realFetchText: FetchFn = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": "garlic-times-ingest/1.0" } });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return res.text();
};

export async function fetchCandidates(
  source: Source,
  opts: { fetchText?: FetchFn; perFeed?: number } = {},
): Promise<Candidate[]> {
  const fetchText = opts.fetchText ?? realFetchText;
  const perFeed = opts.perFeed ?? 10;

  const items: FeedItem[] = [];
  for (const feed of FEEDS[source]) {
    try {
      const xml = await fetchText(feed);
      items.push(...parseFeed(xml).slice(0, perFeed));
    } catch {
      // A dead feed shouldn't sink the whole source.
    }
  }

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    try {
      const html = await fetchText(item.url);
      const extracted = extractArticle(html, item.url);
      if (!extracted) continue;
      candidates.push({
        source,
        url: item.url,
        title: extracted.title || item.title,
        bodyMarkdown: extracted.bodyMarkdown,
        imageUrl: extracted.imageUrl,
      });
    } catch {
      // Skip articles that fail to fetch or extract.
    }
  }
  return candidates;
}
