// tests/build-assets.test.ts
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyAssets } from "../scripts/generate";

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

test("copyAssets tolerates a missing source directory", () => {
  const content = mkdtempSync(join(tmpdir(), "gt-content-"));
  const out = mkdtempSync(join(tmpdir(), "gt-out-"));
  expect(() => copyAssets(content, out)).not.toThrow();
});
