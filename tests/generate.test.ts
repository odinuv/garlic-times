// tests/generate.test.ts
import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEditions, neighbours, writePages } from "../scripts/generate";

const FIX = join(import.meta.dir, "fixtures", "content");

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
    faviconHref: "/static/coat-of-arms.png",
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
