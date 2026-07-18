import { test, expect } from "bun:test";
import { renderDocument } from "@/edition/shell";

test("produces a complete doctype document with head metadata", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hello</main>,
  });
  expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  expect(html).toContain('<html lang="en">');
  expect(html).toContain("<title>T</title>");
  expect(html).toContain('name="description" content="D"');
  expect(html).toContain('href="/styles.css"');
  expect(html).toContain("<main>hello</main>");
});

test("emits RSS autodiscovery link on every page (even without social meta)", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
  });
  expect(html).toContain(
    '<link rel="alternate" type="application/rss+xml" title="The Garlic Times" href="https://www.thegarlictimes.com/rss.xml"/>',
  );
});

test("omits the robots meta by default and emits it when provided", () => {
  const indexable = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
  });
  expect(indexable).not.toContain('name="robots"');

  const noindex = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
    robots: "noindex",
  });
  expect(noindex).toContain('<meta name="robots" content="noindex"/>');
});

test("emits no script tags when no analytics beacon token is provided", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
  });
  expect(html).not.toContain("<script");
});

test("emits the Cloudflare Web Analytics beacon when a token is provided", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
    analyticsBeaconToken: "abc123token",
  });
  expect(html).toContain("https://static.cloudflareinsights.com/beacon.min.js");
  expect(html).toContain('data-cf-beacon="{&quot;token&quot;:&quot;abc123token&quot;}"');
  expect(html).toContain("defer");
});

test("ignores an empty analytics beacon token (stays script-free)", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
    analyticsBeaconToken: "",
  });
  expect(html).not.toContain("<script");
});

test("emits no social/canonical tags when social is omitted", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
  });
  expect(html).not.toContain('property="og:');
  expect(html).not.toContain('name="twitter:');
  expect(html).not.toContain('rel="canonical"');
});

test("emits full Open Graph + Twitter + canonical tags with an image", () => {
  const html = renderDocument({
    title: "Front page",
    description: "Fresh garlic news",
    faviconHref: "/static/new-logo.png",
    social: {
      canonicalUrl: "https://www.thegarlictimes.com/2026-07-14/",
      image: "https://www.thegarlictimes.com/img/2026-07-14/lead.jpg",
      imageAlt: "A rare T. rex garlic",
      ogType: "website",
      twitterCard: "summary_large_image",
    },
    body: <main>hi</main>,
  });
  expect(html).toContain('rel="canonical" href="https://www.thegarlictimes.com/2026-07-14/"');
  expect(html).toContain('property="og:type" content="website"');
  expect(html).toContain('property="og:site_name" content="The Garlic Times"');
  expect(html).toContain('property="og:title" content="Front page"');
  expect(html).toContain('property="og:description" content="Fresh garlic news"');
  expect(html).toContain('property="og:url" content="https://www.thegarlictimes.com/2026-07-14/"');
  expect(html).toContain(
    'property="og:image" content="https://www.thegarlictimes.com/img/2026-07-14/lead.jpg"',
  );
  expect(html).toContain('property="og:image:alt" content="A rare T. rex garlic"');
  expect(html).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain('name="twitter:title" content="Front page"');
  expect(html).toContain(
    'name="twitter:image" content="https://www.thegarlictimes.com/img/2026-07-14/lead.jpg"',
  );
});

test("falls back to a summary card and omits image tags when no image is given", () => {
  const html = renderDocument({
    title: "About",
    description: "About us",
    faviconHref: "/static/new-logo.png",
    social: { canonicalUrl: "https://www.thegarlictimes.com/about/" },
    body: <main>hi</main>,
  });
  expect(html).toContain('name="twitter:card" content="summary"');
  expect(html).not.toContain("og:image");
  expect(html).not.toContain("twitter:image");
});
