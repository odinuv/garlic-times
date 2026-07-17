// src/edition/site.ts
// Canonical origin for the published site. Open Graph / Twitter card consumers
// (Facebook, X, Slack, iMessage, LinkedIn…) fetch pages out of context and can't
// resolve root-relative paths, so og:image / og:url / canonical must be absolute.
// Overridable via SITE_URL so preview/staging builds advertise the correct host;
// defaults to production so a plain `bun run generate` emits shareable cards.
export const SITE_URL =
  process.env.SITE_URL?.replace(/\/+$/, "") || "https://www.thegarlictimes.com";

/** Join the canonical origin with a root-relative path. Absolute URLs pass through unchanged. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
}
