import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { absoluteUrl } from "@/edition/site";

export interface SocialMeta {
  /** Absolute canonical URL of this page (also used as og:url). */
  canonicalUrl: string;
  /** Absolute URL of the preview image. Omit to fall back to no image card. */
  image?: string;
  /** Alt text describing the preview image. */
  imageAlt?: string;
  /** Open Graph object type. "website" for the home/edition front pages. */
  ogType?: string;
  /** Twitter card style. "summary_large_image" when a wide photo is available. */
  twitterCard?: "summary" | "summary_large_image";
}

const SITE_NAME = "The Garlic Times";

export function renderDocument({
  title,
  description,
  faviconHref,
  body,
  analyticsBeaconToken,
  social,
  robots,
}: {
  title: string;
  description: string;
  faviconHref: string;
  body: React.ReactNode;
  /**
   * Value for a `<meta name="robots">` tag. Set to "noindex" on utility pages
   * (e.g. the /subscribed/ thank-you page) that shouldn't appear in search
   * results. Omit on content pages so they stay indexable by default.
   */
  robots?: string;
  /**
   * Cloudflare Web Analytics beacon token. When set, a cookieless,
   * privacy-friendly analytics beacon is emitted on every page. When empty or
   * undefined, no script is emitted (the site stays script-free by default).
   * Sourced at build time from the CF_BEACON_TOKEN env var — see docs/analytics.md.
   */
  analyticsBeaconToken?: string;
  social?: SocialMeta;
}): string {
  const markup = renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        {robots && <meta name="robots" content={robots} />}
        {/* RSS autodiscovery — feed readers pick this up from any page. Absolute
            so it resolves when the page is fetched out of context. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={SITE_NAME}
          href={absoluteUrl("/rss.xml")}
        />
        {social && <link rel="canonical" href={social.canonicalUrl} />}
        {/* Open Graph — Facebook, LinkedIn, Slack, iMessage, WhatsApp, Discord… */}
        {social && (
          <>
            <meta property="og:type" content={social.ogType ?? "website"} />
            <meta property="og:site_name" content={SITE_NAME} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={social.canonicalUrl} />
            {social.image && <meta property="og:image" content={social.image} />}
            {social.image && social.imageAlt && (
              <meta property="og:image:alt" content={social.imageAlt} />
            )}
          </>
        )}
        {/* Twitter / X card */}
        {social && (
          <>
            <meta
              name="twitter:card"
              content={social.twitterCard ?? (social.image ? "summary_large_image" : "summary")}
            />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            {social.image && <meta name="twitter:image" content={social.image} />}
            {social.image && social.imageAlt && (
              <meta name="twitter:image:alt" content={social.imageAlt} />
            )}
          </>
        )}
        <link rel="icon" href={faviconHref} />
        <link rel="stylesheet" href="/styles.css" />
        {analyticsBeaconToken ? (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: analyticsBeaconToken })}
          />
        ) : null}
      </head>
      <body>{body}</body>
    </html>,
  );
  return `<!DOCTYPE html>${markup}`;
}
