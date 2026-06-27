import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

export function renderDocument({
  title,
  description,
  faviconHref,
  body,
}: {
  title: string;
  description: string;
  faviconHref: string;
  body: React.ReactNode;
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
      </head>
      <body>{body}</body>
    </html>,
  );
  return `<!DOCTYPE html>${markup}`;
}
