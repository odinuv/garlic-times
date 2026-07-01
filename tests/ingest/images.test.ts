import { test, expect } from "bun:test";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadImage } from "@/ingest/images";

test("downloadImage writes the fetched bytes to <dir>/<basename>.jpg", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gt-img-"));
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const path = await downloadImage({
    imageUrl: "https://img/x.jpg",
    destDir: dir,
    basename: "cnn-01-russia",
    fetchBytes: async () => bytes,
  });
  expect(path).toBe(join(dir, "cnn-01-russia.jpg"));
  expect(existsSync(path)).toBe(true);
  expect(new Uint8Array(readFileSync(path))).toEqual(bytes);
});
