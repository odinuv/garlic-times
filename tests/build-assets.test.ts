// tests/build-assets.test.ts
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyAssets, referencedImages } from "../scripts/generate";
import type { Edition } from "@/edition/schema";

test("copyAssets mirrors img and static into the output", () => {
  const content = mkdtempSync(join(tmpdir(), "gt-content-"));
  const out = mkdtempSync(join(tmpdir(), "gt-out-"));
  mkdirSync(join(content, "img"), { recursive: true });
  mkdirSync(join(content, "static"), { recursive: true });
  writeFileSync(join(content, "img", "a.jpg"), "x");
  writeFileSync(join(content, "static", "coat.png"), "y");

  copyAssets(content, out);

  expect(existsSync(join(out, "img", "a.jpg"))).toBe(true);
  expect(existsSync(join(out, "static", "coat.png"))).toBe(true);
});

test("copyAssets places robots.txt at the output root", () => {
  const content = mkdtempSync(join(tmpdir(), "gt-content-"));
  const out = mkdtempSync(join(tmpdir(), "gt-out-"));
  writeFileSync(join(content, "robots.txt"), "User-agent: *\nDisallow: /*/*/\n");

  copyAssets(content, out);

  expect(existsSync(join(out, "robots.txt"))).toBe(true);
  expect(existsSync(join(out, "static", "robots.txt"))).toBe(false);
});

test("copyAssets places the Cloudflare _headers file at the output root", () => {
  const content = mkdtempSync(join(tmpdir(), "gt-content-"));
  const out = mkdtempSync(join(tmpdir(), "gt-out-"));
  writeFileSync(join(content, "_headers"), "/img/*\n  Cache-Control: public, max-age=31536000\n");

  copyAssets(content, out);

  expect(existsSync(join(out, "_headers"))).toBe(true);
  expect(existsSync(join(out, "static", "_headers"))).toBe(false);
});

test("copyAssets tolerates a missing source directory", () => {
  const content = mkdtempSync(join(tmpdir(), "gt-content-"));
  const out = mkdtempSync(join(tmpdir(), "gt-out-"));
  expect(() => copyAssets(content, out)).not.toThrow();
});

test("copyAssets mirrors date-namespaced image subfolders", () => {
  const content = mkdtempSync(join(tmpdir(), "gt-content-"));
  const out = mkdtempSync(join(tmpdir(), "gt-out-"));
  mkdirSync(join(content, "img", "2026-07-09"), { recursive: true });
  writeFileSync(join(content, "img", "2026-07-09", "cnn-01-x.jpg"), "z");

  copyAssets(content, out);

  expect(existsSync(join(out, "img", "2026-07-09", "cnn-01-x.jpg"))).toBe(true);
});

test("copyAssets ships only the referenced images when a keep-set is given", () => {
  const content = mkdtempSync(join(tmpdir(), "gt-content-"));
  const out = mkdtempSync(join(tmpdir(), "gt-out-"));
  mkdirSync(join(content, "img", "2026-07-09"), { recursive: true });
  mkdirSync(join(content, "static"), { recursive: true });
  // A published photo, its untouched download original, and an orphan from an
  // earlier run — all live side by side in content/img.
  writeFileSync(join(content, "img", "2026-07-09", "cnn-01-x.jpg"), "keep");
  writeFileSync(join(content, "img", "2026-07-09", "cnn-01-x-source.jpg"), "original");
  writeFileSync(join(content, "img", "orphan.jpg"), "leftover");
  writeFileSync(join(content, "img", "advert.jpg"), "keep");
  writeFileSync(join(content, "static", "coat.png"), "chrome");

  copyAssets(content, out, new Set(["img/2026-07-09/cnn-01-x.jpg", "img/advert.jpg"]));

  // Referenced images ship.
  expect(existsSync(join(out, "img", "2026-07-09", "cnn-01-x.jpg"))).toBe(true);
  expect(existsSync(join(out, "img", "advert.jpg"))).toBe(true);
  // Source originals and orphans do not.
  expect(existsSync(join(out, "img", "2026-07-09", "cnn-01-x-source.jpg"))).toBe(false);
  expect(existsSync(join(out, "img", "orphan.jpg"))).toBe(false);
  // static/ is always mirrored wholesale — it holds site chrome, not editions.
  expect(existsSync(join(out, "static", "coat.png"))).toBe(true);
});

test("copyAssets prunes images left in the output from an earlier build", () => {
  const content = mkdtempSync(join(tmpdir(), "gt-content-"));
  const out = mkdtempSync(join(tmpdir(), "gt-out-"));
  mkdirSync(join(content, "img"), { recursive: true });
  writeFileSync(join(content, "img", "current.jpg"), "keep");
  // A previous build already populated dist/img with an image no longer referenced.
  mkdirSync(join(out, "img"), { recursive: true });
  writeFileSync(join(out, "img", "stale.jpg"), "old");

  copyAssets(content, out, new Set(["img/current.jpg"]));

  expect(existsSync(join(out, "img", "current.jpg"))).toBe(true);
  expect(existsSync(join(out, "img", "stale.jpg"))).toBe(false);
});

test("referencedImages collects article + advert image paths under img/, normalized", () => {
  const editions = [
    {
      masthead: { glyph: "/static/logo.png" },
      advert: { src: "/img/advert.jpg" },
      articles: [
        { image: { src: "/img/2026-07-09/a.jpg" } },
        { image: { src: "/img/2026-07-09/b.jpg" } },
        { body: ["no image here"] },
      ],
    },
  ] as unknown as Edition[];

  expect(referencedImages(editions)).toEqual(
    new Set(["img/advert.jpg", "img/2026-07-09/a.jpg", "img/2026-07-09/b.jpg"]),
  );
});
