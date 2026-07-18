// src/edition/feed.ts
// Deterministic RSS 2.0 feed for The Garlic Times. Pure functions, no I/O:
// the whole feed is derived from the edition data plus a fixed site origin, so
// the generate step stays reproducible from the content on disk (no network,
// no Date.now(), no Math.random()).
//
// One <item> per article across the most recent editions, newest first, capped
// at MAX_ITEMS so the feed stays small as the archive grows. Article links use
// the crawlable "/<date>/#article-N" anchors (not the /<date>/<n>/ "like" stubs
// that robots.txt disallows).
import type { Article, Edition } from "@/edition/schema";
import { SITE_URL } from "@/edition/site";

/** Cap on total items so the feed stays lightweight as editions accumulate. */
export const MAX_ITEMS = 40;

const CHANNEL_DESCRIPTION =
  "The Garlic Times — a satirical vintage newspaper, regenerated daily. " +
  "Cabinet talks, railway negotiations, foreign affairs, and the daily garlic recipe.";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Strip **bold** markup and collapse whitespace for plain-text descriptions. */
export function plainText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max = 300): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * RFC-822 date string for an edition. Editions publish on the 06:00 UTC daily
 * cron, so that is used as a stable, deterministic timestamp. Built from the
 * date string only (no Date.now()) so the feed is reproducible.
 */
export function rfc822(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 6, 0, 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${WEEKDAYS[dt.getUTCDay()]}, ${pad(d)} ${MONTHS[m - 1]} ${y} ` + `06:00:00 GMT`;
}

export interface FeedItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description: string;
}

function articleLink(origin: string, date: string, n: number): string {
  return `${origin}/${date}/#article-${n}`;
}

function itemFor(origin: string, edition: Edition, article: Article, n: number): FeedItem {
  const link = articleLink(origin, edition.date, n);
  return {
    title: article.title,
    link,
    guid: link,
    pubDate: rfc822(edition.date),
    description: truncate(plainText(article.body[0] ?? article.title)),
  };
}

/** One item per article across all editions, newest first, capped at `max`. */
export function feedItems(
  editions: Edition[],
  origin: string = SITE_URL,
  max: number = MAX_ITEMS,
): FeedItem[] {
  const sorted = [...editions].sort((a, b) => b.date.localeCompare(a.date));
  const items: FeedItem[] = [];
  for (const edition of sorted) {
    edition.articles.forEach((article, i) => {
      items.push(itemFor(origin, edition, article, i + 1));
    });
  }
  return items.slice(0, max);
}

/** Render the full RSS 2.0 document for the given editions. */
export function buildFeed(editions: Edition[], origin: string = SITE_URL): string {
  const items = feedItems(editions, origin);
  const newest = [...editions].sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastBuildDate = rfc822(newest?.date ?? "1970-01-01");

  const itemsXml = items
    .map(
      (it) =>
        `    <item>\n` +
        `      <title>${escapeXml(it.title)}</title>\n` +
        `      <link>${escapeXml(it.link)}</link>\n` +
        `      <guid isPermaLink="true">${escapeXml(it.guid)}</guid>\n` +
        `      <pubDate>${it.pubDate}</pubDate>\n` +
        `      <description>${escapeXml(it.description)}</description>\n` +
        `    </item>`,
    )
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `  <channel>\n` +
    `    <title>The Garlic Times</title>\n` +
    `    <link>${escapeXml(`${origin}/`)}</link>\n` +
    `    <atom:link href="${escapeXml(`${origin}/rss.xml`)}" rel="self" type="application/rss+xml" />\n` +
    `    <description>${escapeXml(CHANNEL_DESCRIPTION)}</description>\n` +
    `    <language>en</language>\n` +
    `    <lastBuildDate>${lastBuildDate}</lastBuildDate>\n` +
    (itemsXml ? `${itemsXml}\n` : ``) +
    `  </channel>\n` +
    `</rss>\n`
  );
}
