// scripts/generate.ts
import React from "react";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  cpSync,
  statSync,
  rmSync,
} from "node:fs";
import { join, relative, sep } from "node:path";
import { imageSize } from "image-size";
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
 * Read a raster image's *displayed* pixel dimensions from its header bytes via
 * `image-size` (pure JS, no decode). PNG (masthead/glyphs) and JPEG (article
 * photos) are the formats the site ships. For EXIF-rotated JPEGs (orientation
 * 5–8 rotate the frame a quarter turn) the stored width/height are transposed
 * relative to what the browser paints, so we swap them back — otherwise a
 * portrait phone photo would reserve a landscape box and reintroduce the layout
 * shift this is meant to remove. Returns null for anything unreadable or
 * unsupported so callers can fall back to omitting the attributes.
 */
export function imageDimensions(buf: Uint8Array): { width: number; height: number } | null {
  try {
    const { width, height, orientation } = imageSize(buf);
    if (!width || !height) return null;
    return orientation && orientation >= 5 && orientation <= 8
      ? { width: height, height: width }
      : { width, height };
  } catch {
    return null;
  }
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

/**
 * Every image file the rendered site actually links to, as content-relative
 * POSIX paths under `img/` (e.g. `img/2026-07-09/cnn-01-x.jpg`, `img/advert.jpg`).
 * Article photos and the advert are the only images served from `img/`; the
 * masthead glyph lives under `static/`, which ships wholesale, so it's not
 * collected here. Used to keep the download originals (`*-source.jpg`) and
 * orphaned images from earlier runs out of `dist/` — they stay in `content/`
 * for the archive but never ship to Cloudflare.
 */
export function referencedImages(editions: Edition[]): Set<string> {
  const keep = new Set<string>();
  const add = (src: string | undefined) => {
    if (!src) return;
    const rel = src.replace(/^\/+/, "");
    if (rel.startsWith("img/")) keep.add(rel);
  };
  for (const edition of editions) {
    add(edition.advert.src);
    for (const article of edition.articles) add(article.image?.src);
  }
  return keep;
}

export function copyAssets(
  contentDir: string,
  outDir: string,
  keepImages?: ReadonlySet<string>,
): void {
  for (const sub of ["img", "static"]) {
    const from = join(contentDir, sub);
    if (!existsSync(from)) continue;
    const to = join(outDir, sub);
    if (sub === "img" && keepImages) {
      // Copy only images the editions reference; recurse into directories but
      // drop unreferenced files (download originals, orphans from prior runs).
      // Clear the destination first so the result is exactly the referenced set
      // even when a previous build left stale images behind (cpSync only adds).
      rmSync(to, { recursive: true, force: true });
      cpSync(from, to, {
        recursive: true,
        filter: (srcPath) => {
          if (statSync(srcPath).isDirectory()) return true;
          const rel = relative(contentDir, srcPath).split(sep).join("/");
          return keepImages.has(rel);
        },
      });
    } else {
      cpSync(from, to, { recursive: true });
    }
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
  copyAssets(contentDir, outDir, referencedImages(editions));
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
