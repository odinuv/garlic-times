import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

export function renderDocument({
  title,
  description,
  faviconHref,
  body,
  analyticsBeaconToken,
}: {
  title: string;
  description: string;
  faviconHref: string;
  body: React.ReactNode;
  /**
   * Cloudflare Web Analytics beacon token. When set, a cookieless,
   * privacy-friendly analytics beacon is emitted on every page. When empty or
   * undefined, no script is emitted (the site stays script-free by default).
   * Sourced at build time from the CF_BEACON_TOKEN env var — see docs/analytics.md.
   */
  analyticsBeaconToken?: string;
}): string {
  const markup = renderToStaticMarkup(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
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
