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

// Google-News XML sitemap: <urlset><url><loc>ARTICLE_URL</loc>
// <news:news><news:title>TITLE</news:title></news:news></url>. Used for CNN,
// whose RSS was frozen in 2024; the sitemap has fresh, direct article URLs.
export function parseNewsSitemap(xml: string): FeedItem[] {
  const doc = parser.parse(xml);
  const rawUrls = doc?.urlset?.url ?? [];
  const urls = Array.isArray(rawUrls) ? rawUrls : [rawUrls];
  return urls
    .map((u: { loc?: unknown; "news:news"?: { "news:title"?: unknown } }) => {
      const rawTitle = u["news:news"]?.["news:title"];
      return {
        title:
          typeof rawTitle === "string"
            ? rawTitle.trim()
            : typeof rawTitle === "number"
              ? String(rawTitle)
              : "",
        url: typeof u.loc === "string" ? u.loc.trim() : "",
      };
    })
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

export type FeedKind = "rss" | "sitemap";

// News sources per outlet, newest-first. CNN's RSS (rss.cnn.com) was frozen in
// 2024, so CNN uses its Google-News sitemap (fresh, direct article URLs); Fox's
// RSS is current. Single place to adjust feeds.
export const FEEDS: Record<Source, { url: string; kind: FeedKind }[]> = {
  cnn: [{ url: "https://www.cnn.com/sitemap/news.xml", kind: "sitemap" }],
  fox: [
    { url: "https://moxie.foxnews.com/google-publisher/latest.xml", kind: "rss" },
    { url: "https://moxie.foxnews.com/google-publisher/politics.xml", kind: "rss" },
  ],
};

export type FetchFn = (url: string) => Promise<string>;

const realFetchText: FetchFn = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": "garlic-times-ingest/1.0" } });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  return res.text();
};

// Strip a trailing outlet tag like " | CNN", " | CNN Politics", " - Fox News".
export function cleanTitle(title: string): string {
  return title
    .replace(/\s*[|–—-]\s*(?:CNN(?:\s+\w+)*|Fox\s*News(?:\.com)?|FOX\s*News)\s*$/i, "")
    .trim();
}

export async function fetchCandidates(
  source: Source,
  opts: { fetchText?: FetchFn; perFeed?: number } = {},
): Promise<Candidate[]> {
  const fetchText = opts.fetchText ?? realFetchText;
  const perFeed = opts.perFeed ?? 10;

  const items: FeedItem[] = [];
  for (const feed of FEEDS[source]) {
    try {
      const xml = await fetchText(feed.url);
      const parsed = feed.kind === "sitemap" ? parseNewsSitemap(xml) : parseFeed(xml);
      items.push(...parsed.slice(0, perFeed));
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
        title: cleanTitle(extracted.title || item.title),
        bodyMarkdown: extracted.bodyMarkdown,
        imageUrl: extracted.imageUrl,
      });
    } catch {
      // Skip articles that fail to fetch or extract.
    }
  }
  return candidates;
}
