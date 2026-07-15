// scripts/generate.ts
import React from "react";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, cpSync } from "node:fs";
import { join } from "node:path";
import { parseEdition, type Edition } from "@/edition/schema";
import { buildFeed } from "@/edition/feed";
import { EditionPage } from "@/edition/Edition";
import { SubscribedPage } from "@/edition/Subscribed";
import { newsletterConfigFromEnv, type NewsletterConfig } from "@/edition/newsletter";
import { renderDocument, type SocialMeta } from "@/edition/shell";
import { absoluteUrl } from "@/edition/site";

/**
 * Choose the share-card image for an edition: the first article that carries a
 * photo (rich `summary_large_image` card) or the masthead glyph as a fallback
 * (small `summary` card). Returned paths are made absolute for OG/Twitter.
 */
export function editionSocial(edition: Edition): SocialMeta {
  const withImage = edition.articles.find((a) => a.image);
  const canonicalUrl = absoluteUrl(`/${edition.date}/`);
  if (withImage?.image) {
    return {
      canonicalUrl,
      image: absoluteUrl(withImage.image.src),
      imageAlt: withImage.image.alt || edition.meta.title,
      ogType: "website",
      twitterCard: "summary_large_image",
    };
  }
  return {
    canonicalUrl,
    image: absoluteUrl(edition.masthead.glyph),
    imageAlt: "The Garlic Times",
    ogType: "website",
    twitterCard: "summary",
  };
}

export function loadEditions(srcDir: string): Edition[] {
  const files = readdirSync(srcDir).filter((f) => f.endsWith(".json"));
  const editions = files.map((f) =>
    parseEdition(JSON.parse(readFileSync(join(srcDir, f), "utf8")), f),
  );
  return editions.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Read a raster image's intrinsic pixel dimensions straight from its header
 * bytes — no image library, no decode. Supports the two formats the site ships:
 * PNG (masthead/glyphs) and JPEG (article photos). Returns null for anything it
 * can't parse so callers can fall back to omitting the attributes.
 */
export function imageDimensions(buf: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // PNG: 8-byte signature, then IHDR whose width/height are big-endian u32 at 16/20.
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: walk the marker segments until a Start-Of-Frame (SOFn) carries the size.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1];
      // Standalone markers (no length payload): padding, RSTn, SOI/EOI.
      if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        off += 2;
        continue;
      }
      const len = view.getUint16(off + 2);
      // SOF0..SOF15, excluding the non-frame markers DHT(C4), JPG(C8), DAC(CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: view.getUint16(off + 5), width: view.getUint16(off + 7) };
      }
      off += 2 + len;
    }
  }
  return null;
}

/**
 * Fill in each article image's intrinsic width/height from the file on disk so
 * the rendered <img> reserves its box before loading — eliminating the layout
 * shift (CLS) that lazy photos otherwise cause. Pure: returns new editions and
 * silently leaves dimensions unset for any image whose file is missing.
 */
export function withImageDimensions(editions: Edition[], contentDir: string): Edition[] {
  return editions.map((edition) => ({
    ...edition,
    articles: edition.articles.map((article) => {
      if (!article.image || article.image.width) return article;
      const file = join(contentDir, article.image.src.replace(/^\/+/, ""));
      if (!existsSync(file)) return article;
      try {
        const dims = imageDimensions(readFileSync(file));
        return dims ? { ...article, image: { ...article.image, ...dims } } : article;
      } catch {
        return article;
      }
    }),
  }));
}

export function neighbours(
  editions: Edition[],
  index: number,
): { prevDate: string | null; nextDate: string | null } {
  return {
    prevDate: index > 0 ? editions[index - 1].date : null,
    nextDate: index < editions.length - 1 ? editions[index + 1].date : null,
  };
}

function writeHtml(outDir: string, segments: string[], html: string) {
  const dir = join(outDir, ...segments);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
}

export function renderRedirect(date: string, n: number): string {
  const url = `/${date}/#article-${n}`;
  return (
    `<!DOCTYPE html><meta charset="utf-8">` +
    `<meta http-equiv="refresh" content="0;url=${url}">` +
    `<script>location.replace(${JSON.stringify(url)})</script>` +
    `<a href="${url}">Continue</a>`
  );
}

export async function writePages(opts: {
  editions: Edition[];
  aboutHtml: string;
  outDir: string;
  analyticsBeaconToken?: string;
  newsletter?: NewsletterConfig | null;
}): Promise<void> {
  const { editions, aboutHtml, outDir, analyticsBeaconToken, newsletter = null } = opts;
  if (editions.length === 0) throw new Error("No editions found in content/src");

  editions.forEach((edition, i) => {
    const { prevDate, nextDate } = neighbours(editions, i);
    const html = renderDocument({
      title: edition.meta.title,
      description: edition.meta.description,
      faviconHref: edition.masthead.glyph,
      social: editionSocial(edition),
      body: React.createElement(EditionPage, { edition, prevDate, nextDate, newsletter }),
      analyticsBeaconToken,
    });
    writeHtml(outDir, [edition.date], html);
    edition.articles.forEach((_, idx) => {
      const n = idx + 1;
      writeHtml(outDir, [edition.date, String(n)], renderRedirect(edition.date, n));
    });
    if (i === editions.length - 1) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "index.html"), html); // root = newest
    }
  });

  const aboutGlyph = editions[editions.length - 1].masthead.glyph;
  const aboutDoc = renderDocument({
    title: "About — The Garlic Times",
    description: "About The Garlic Times.",
    faviconHref: aboutGlyph,
    social: {
      canonicalUrl: absoluteUrl("/about/"),
      image: absoluteUrl(aboutGlyph),
      imageAlt: "The Garlic Times",
      ogType: "website",
      twitterCard: "summary",
    },
    body: React.createElement("div", { dangerouslySetInnerHTML: { __html: aboutHtml } }),
    analyticsBeaconToken,
  });
  writeHtml(outDir, ["about"], aboutDoc);

  // Thank-you page the newsletter provider redirects to after a successful
  // signup (MailerLite's custom success URL points at /subscribed/). A utility
  // page, so it's marked noindex and canonicalises to itself.
  const subscribedGlyph = editions[editions.length - 1].masthead.glyph;
  const subscribedDoc = renderDocument({
    title: "Subscribed — The Garlic Times",
    description: "Your subscription to The Garlic Times is noted.",
    faviconHref: subscribedGlyph,
    robots: "noindex",
    social: {
      canonicalUrl: absoluteUrl("/subscribed/"),
      image: absoluteUrl(subscribedGlyph),
      imageAlt: "The Garlic Times",
      ogType: "website",
      twitterCard: "summary",
    },
    body: React.createElement(SubscribedPage, { glyph: subscribedGlyph }),
    analyticsBeaconToken,
  });
  writeHtml(outDir, ["subscribed"], subscribedDoc);
}

export function copyAssets(contentDir: string, outDir: string): void {
  for (const sub of ["img", "static"]) {
    const from = join(contentDir, sub);
    if (existsSync(from)) cpSync(from, join(outDir, sub), { recursive: true });
  }
  // Root-level files served from the site root (e.g. /robots.txt, /_headers), not
  // under /static/. `_headers` sets Cloudflare Pages cache rules (see content/_headers).
  for (const file of ["robots.txt", "_headers"]) {
    const from = join(contentDir, file);
    if (existsSync(from)) cpSync(from, join(outDir, file));
  }
}

export async function compileCss(inputCss: string, outCss: string): Promise<void> {
  // Use Bun.argv[0] so this works regardless of whether bun is on PATH
  const bunBin = Bun.argv[0];
  const proc = Bun.spawn(
    [bunBin, "x", "@tailwindcss/cli", "-i", inputCss, "-o", outCss, "--minify"],
    {
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  const code = await proc.exited;
  if (code !== 0) throw new Error(`Tailwind CLI failed with exit code ${code}`);
}

export async function build(opts: {
  contentDir: string;
  outDir: string;
  analyticsBeaconToken?: string;
  newsletter?: NewsletterConfig | null;
}): Promise<void> {
  const { contentDir, outDir, analyticsBeaconToken, newsletter = null } = opts;
  const editions = withImageDimensions(loadEditions(join(contentDir, "src")), contentDir);
  const aboutPath = join(contentDir, "about.html");
  const aboutHtml = existsSync(aboutPath)
    ? readFileSync(aboutPath, "utf8")
    : "<section><h1>About</h1></section>";
  await writePages({ editions, aboutHtml, outDir, analyticsBeaconToken, newsletter });
  // Owned-audience capture: an RSS feed of recent articles at /rss.xml so readers
  // can subscribe in any feed reader. Deterministic — derived from the editions.
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "rss.xml"), buildFeed(editions));
  copyAssets(contentDir, outDir);
  await compileCss("src/styles.css", join(outDir, "styles.css"));
}

if (import.meta.main) {
  // Optional cookieless analytics beacon; no-op when the env var is unset.
  const analyticsBeaconToken = process.env.CF_BEACON_TOKEN?.trim() || undefined;
  // Owned-audience capture: newsletter signup box, gated on NEWSLETTER_FORM_ACTION.
  // Null when unconfigured, so the box renders nothing and the build still succeeds.
  const newsletter = newsletterConfigFromEnv();
  build({ contentDir: "content", outDir: "dist", analyticsBeaconToken, newsletter })
    .then(() =>
      console.log(
        analyticsBeaconToken
          ? "Generated dist/ (with Cloudflare Web Analytics beacon)"
          : "Generated dist/ (analytics beacon disabled: CF_BEACON_TOKEN unset)",
      ),
    )
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
