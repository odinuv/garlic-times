// tests/generate.test.ts
import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadEditions,
  neighbours,
  writePages,
  renderRedirect,
  editionSocial,
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
  expect(subscribed).toContain("Your subscription is noted");
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
