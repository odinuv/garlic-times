// tests/generate.test.ts
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadEditions,
  neighbours,
  writePages,
  renderRedirect,
  editionSocial,
  imageDimensions,
  withImageDimensions,
} from "../scripts/generate";
import { validEdition } from "./fixtures/valid-edition";

const FIX = join(import.meta.dir, "fixtures", "content");

test("editionSocial uses the first article photo as a large-image card", () => {
  const social = editionSocial(validEdition);
  expect(social.canonicalUrl).toBe("https://www.thegarlictimes.com/2026-06-27/");
  expect(social.image).toBe("https://www.thegarlictimes.com/img/main.jpg");
  expect(social.imageAlt).toBe("Ministers leaving");
  expect(social.twitterCard).toBe("summary_large_image");
});

test("editionSocial falls back to the masthead glyph as a summary card", () => {
  const noPhotos = {
    ...validEdition,
    articles: validEdition.articles.map(({ image: _image, ...rest }) => rest),
  };
  const social = editionSocial(noPhotos);
  expect(social.image).toBe("https://www.thegarlictimes.com/static/coat-of-arms.png");
  expect(social.twitterCard).toBe("summary");
});

// image-size itself is well tested for parsing PNG/JPEG (baseline, progressive,
// truncated) — so these tests cover only what we add on top: the EXIF
// orientation swap and the null fallback. Byte builders assemble just enough of
// a real file to carry an orientation tag and dimensions.
const u16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
const u16LE = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const u32 = (n: number): number[] => [
  (n >>> 24) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 8) & 0xff,
  n & 0xff,
];
const u32LE = (n: number): number[] => [
  n & 0xff,
  (n >> 8) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 24) & 0xff,
];

// A valid minimal PNG: 8-byte signature + a complete IHDR chunk (used by the
// on-disk integration test).
function png(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a, // signature
    ...u32(13),
    0x49,
    0x48,
    0x44,
    0x52, // IHDR chunk length + name
    ...u32(width),
    ...u32(height),
    0x08,
    0x06,
    0x00,
    0x00,
    0x00, // bit depth, colour type, compression, filter, interlace
    ...u32(0), // CRC (unchecked by the size reader)
  ]);
}

// An APP1/EXIF segment carrying just the orientation tag (0x0112), little-endian.
function app1Orientation(orientation: number): Uint8Array {
  const body = [
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // "Exif\0\0"
    0x49,
    0x49,
    0x2a,
    0x00, // TIFF little-endian marker
    ...u32LE(8), // IFD0 offset
    ...u16LE(1), // one directory entry
    ...u16LE(0x0112), // tag: orientation
    ...u16LE(3), // type: SHORT
    ...u32LE(1), // count
    orientation & 0xff,
    0x00,
    0x00,
    0x00, // value (SHORT in the low 2 bytes)
    ...u32LE(0), // next-IFD offset
  ];
  return Uint8Array.from([0xff, 0xe1, ...u16(body.length + 2), ...body]);
}

// A minimal JPEG carrying an EXIF orientation segment before its SOF0 frame.
function exifJpeg(width: number, height: number, orientation: number): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8, // SOI
    ...app1Orientation(orientation),
    0xff,
    0xc0,
    ...u16(17),
    0x08,
    ...u16(height),
    ...u16(width), // SOF0 header + size
    0x03,
    0x01,
    0x22,
    0x00,
    0x02,
    0x11,
    0x00,
    0x03,
    0x11,
    0x00, // 3 component specs
  ]);
}

test("imageDimensions swaps width/height for EXIF-rotated (orientation 5–8) JPEGs", () => {
  // A portrait phone photo stores a landscape frame (1200×800) plus an
  // orientation tag; the browser paints it rotated, so the reserved box must be
  // the transposed 800×1200 — otherwise the swap-less box reintroduces CLS.
  for (const orientation of [5, 6, 7, 8]) {
    expect(imageDimensions(exifJpeg(1200, 800, orientation))).toEqual({ width: 800, height: 1200 });
  }
});

test("imageDimensions leaves non-rotating orientations (1–4) unswapped", () => {
  for (const orientation of [1, 2, 3, 4]) {
    expect(imageDimensions(exifJpeg(1200, 800, orientation))).toEqual({ width: 1200, height: 800 });
  }
});

test("imageDimensions returns null for unreadable input", () => {
  expect(imageDimensions(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull();
});

test("withImageDimensions fills dimensions from files on disk and skips missing ones", () => {
  const content = mkdtempSync(join(tmpdir(), "gt-dim-"));
  mkdirSync(join(content, "img"), { recursive: true });
  writeFileSync(join(content, "img", "lead.png"), png(1200, 800));

  const edition = {
    ...validEdition,
    articles: validEdition.articles.map((a, i) => {
      if (i === 0) return { ...a, image: { src: "/img/lead.png", alt: "on disk" } };
      if (i === 1) return { ...a, image: { src: "/img/absent.jpg", alt: "missing" } };
      return a;
    }),
  };

  const [out] = withImageDimensions([edition], content);
  // present file → dimensions filled
  expect(out.articles[0].image).toMatchObject({ width: 1200, height: 800 });
  // missing file → left as-is (no crash, no dimensions)
  expect(out.articles[1].image?.width).toBeUndefined();
  // article without a photo is untouched
  expect(out.articles[2].image).toBeUndefined();
});

test("loadEditions returns editions sorted ascending by date", () => {
  const eds = loadEditions(join(FIX, "src"));
  expect(eds.map((e) => e.date)).toEqual(["2026-06-25", "2026-06-26", "2026-06-27"]);
});

test("neighbours wires prev/next by position", () => {
  const eds = loadEditions(join(FIX, "src"));
  expect(neighbours(eds, 0)).toEqual({ prevDate: null, nextDate: "2026-06-26" });
  expect(neighbours(eds, 1)).toEqual({ prevDate: "2026-06-25", nextDate: "2026-06-27" });
  expect(neighbours(eds, 2)).toEqual({ prevDate: "2026-06-26", nextDate: null });
});

test("writePages emits per-date pages, root index, and about", async () => {
  const eds = loadEditions(join(FIX, "src"));
  const out = mkdtempSync(join(tmpdir(), "gt-"));
  await writePages({
    editions: eds,
    aboutHtml: "<section>About</section>",
    outDir: out,
  });

  expect(existsSync(join(out, "2026-06-25", "index.html"))).toBe(true);
  expect(existsSync(join(out, "2026-06-26", "index.html"))).toBe(true);
  expect(existsSync(join(out, "2026-06-27", "index.html"))).toBe(true);
  expect(existsSync(join(out, "about", "index.html"))).toBe(true);

  const root = readFileSync(join(out, "index.html"), "utf8");
  const newest = readFileSync(join(out, "2026-06-27", "index.html"), "utf8");
  expect(root).toBe(newest); // root === newest edition

  // newest has a prev arrow but no next arrow
  expect(newest).toContain('href="/2026-06-26/"');
  expect(newest).not.toContain('href="/2026-06-28/"');

  const about = readFileSync(join(out, "about", "index.html"), "utf8");
  expect(about).toContain("About");
  expect(about).toContain('href="/styles.css"');
});

test("writePages emits Open Graph tags on edition and about pages", async () => {
  const eds = loadEditions(join(FIX, "src"));
  const out = mkdtempSync(join(tmpdir(), "gt-"));
  await writePages({ editions: eds, aboutHtml: "<section>About</section>", outDir: out });

  const edition = readFileSync(join(out, "2026-06-27", "index.html"), "utf8");
  expect(edition).toContain('property="og:type" content="website"');
  expect(edition).toContain(
    'property="og:url" content="https://www.thegarlictimes.com/2026-06-27/"',
  );
  expect(edition).toContain('rel="canonical" href="https://www.thegarlictimes.com/2026-06-27/"');
  expect(edition).toContain('name="twitter:card"');

  const about = readFileSync(join(out, "about", "index.html"), "utf8");
  expect(about).toContain('property="og:url" content="https://www.thegarlictimes.com/about/"');
  expect(about).toContain('name="twitter:card" content="summary"');
});

test("writePages emits the /subscribed/ thank-you page (noindex, self-canonical)", async () => {
  const eds = loadEditions(join(FIX, "src"));
  const out = mkdtempSync(join(tmpdir(), "gt-"));
  await writePages({ editions: eds, aboutHtml: "<section>About</section>", outDir: out });

  const subscribed = readFileSync(join(out, "subscribed", "index.html"), "utf8");
  expect(subscribed).toContain("Your subscription has taken root");
  expect(subscribed).toContain('<meta name="robots" content="noindex"/>');
  expect(subscribed).toContain('rel="canonical" href="https://www.thegarlictimes.com/subscribed/"');
  expect(subscribed).toContain("<title>Subscribed — The Garlic Times</title>");
});

test("every page head carries the RSS autodiscovery link", async () => {
  const eds = loadEditions(join(FIX, "src"));
  const out = mkdtempSync(join(tmpdir(), "gt-"));
  await writePages({ editions: eds, aboutHtml: "<section>About</section>", outDir: out });

  const autodiscovery =
    '<link rel="alternate" type="application/rss+xml" title="The Garlic Times" href="https://www.thegarlictimes.com/rss.xml"/>';
  for (const path of [
    ["index.html"],
    ["2026-06-27", "index.html"],
    ["about", "index.html"],
    ["subscribed", "index.html"],
  ]) {
    expect(readFileSync(join(out, ...path), "utf8")).toContain(autodiscovery);
  }
});

test("writePages mounts the signup box on editions when a newsletter config is given", async () => {
  const eds = loadEditions(join(FIX, "src"));
  const out = mkdtempSync(join(tmpdir(), "gt-"));
  await writePages({
    editions: eds,
    aboutHtml: "<section>About</section>",
    outDir: out,
    newsletter: { action: "https://provider.example/subscribe", emailField: "fields[email]" },
  });

  const edition = readFileSync(join(out, "2026-06-27", "index.html"), "utf8");
  expect(edition).toContain('action="https://provider.example/subscribe"');
  expect(edition).toContain('aria-label="Subscribe"');

  // Unconfigured (default) => no box, build still succeeds.
  const out2 = mkdtempSync(join(tmpdir(), "gt-"));
  await writePages({ editions: eds, aboutHtml: "<section>About</section>", outDir: out2 });
  const plain = readFileSync(join(out2, "2026-06-27", "index.html"), "utf8");
  expect(plain).not.toContain('aria-label="Subscribe"');
});

test("renderRedirect targets the article anchor with meta + JS", () => {
  const html = renderRedirect("2026-06-27", 3);
  expect(html).toContain('content="0;url=/2026-06-27/#article-3"');
  expect(html).toContain('location.replace("/2026-06-27/#article-3")');
});

test("writePages emits one redirect page per article", async () => {
  const eds = loadEditions(join(FIX, "src"));
  const out = mkdtempSync(join(tmpdir(), "gt-"));
  await writePages({ editions: eds, aboutHtml: "<section>About</section>", outDir: out });

  const ed = eds.find((e) => e.date === "2026-06-27")!;
  for (let n = 1; n <= ed.articles.length; n++) {
    expect(existsSync(join(out, "2026-06-27", String(n), "index.html"))).toBe(true);
  }
  // no stray page beyond the article count
  expect(existsSync(join(out, "2026-06-27", String(ed.articles.length + 1), "index.html"))).toBe(
    false,
  );

  const first = readFileSync(join(out, "2026-06-27", "1", "index.html"), "utf8");
  expect(first).toContain('location.replace("/2026-06-27/#article-1")');
});
