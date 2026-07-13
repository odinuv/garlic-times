import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeBlobStore } from "@/archive/blob";

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
