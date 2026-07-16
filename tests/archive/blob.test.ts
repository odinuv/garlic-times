import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeBlobStore } from "@/archive/blob";

test("fake blob store round-trips text and returns null for a missing blob", async () => {
  const backing = mkdtempSync(join(tmpdir(), "gt-blob-"));
  const store = createFakeBlobStore(backing);

  expect(await store.downloadText("reports/2026-07-15.md")).toBeNull();

  // Nested prefixes (raw/, reports/) must be created on write.
  await store.uploadText("raw/2026-07-15.json", '{"ok":true}');
  await store.uploadText("reports/2026-07-15.md", "# hello garlic");

  expect(await store.downloadText("raw/2026-07-15.json")).toBe('{"ok":true}');
  expect(await store.downloadText("reports/2026-07-15.md")).toBe("# hello garlic");
});

test("fake blob store round-trips a file and reports existence", async () => {
  const backing = mkdtempSync(join(tmpdir(), "gt-blob-"));
  const work = mkdtempSync(join(tmpdir(), "gt-work-"));
  const store = createFakeBlobStore(backing);

  expect(await store.exists("state.tar.gz")).toBe(false);

  const src = join(work, "src.bin");
  writeFileSync(src, "hello-garlic");
  await store.upload("state.tar.gz", src);
  expect(await store.exists("state.tar.gz")).toBe(true);

  const dest = join(work, "dest.bin");
  await store.download("state.tar.gz", dest);
  expect(existsSync(dest)).toBe(true);
  expect(readFileSync(dest, "utf8")).toBe("hello-garlic");
});
