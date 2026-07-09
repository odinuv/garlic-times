import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeBlobStore } from "@/archive/blob";
import { restoreState, saveState, archiveTodaysPool } from "@/archive/state";

function seedRoot(root: string) {
  mkdirSync(join(root, "content", "src"), { recursive: true });
  mkdirSync(join(root, "content", "img", "2026-07-09"), { recursive: true });
  mkdirSync(join(root, "content", "sources", "cnn"), { recursive: true });
  writeFileSync(join(root, "content", "src", "2026-07-09.json"), "{}");
  writeFileSync(join(root, "content", "img", "2026-07-09", "cnn-01-x.jpg"), "img");
  writeFileSync(join(root, "content", "market.json"), "{}");
  writeFileSync(join(root, "content", "sources", "cnn", "01-x.json"), "{}");
}

test("archiveTodaysPool copies the live pool into archive/sources/<date>", () => {
  const root = mkdtempSync(join(tmpdir(), "gt-root-"));
  seedRoot(root);
  archiveTodaysPool({ root, date: "2026-07-09" });
  expect(existsSync(join(root, "archive", "sources", "2026-07-09", "cnn", "01-x.json"))).toBe(true);
});

test("saveState then restoreState round-trips the cumulative state", async () => {
  const backing = mkdtempSync(join(tmpdir(), "gt-blob-"));
  const store = createFakeBlobStore(backing);

  const rootA = mkdtempSync(join(tmpdir(), "gt-rootA-"));
  seedRoot(rootA);
  await saveState(store, { root: rootA, date: "2026-07-09", tmpTar: join(rootA, "state.tar.gz") });

  const rootB = mkdtempSync(join(tmpdir(), "gt-rootB-"));
  const res = await restoreState(store, { root: rootB, tmpTar: join(rootB, "state.tar.gz") });

  expect(res.restored).toBe(true);
  expect(readFileSync(join(rootB, "content", "src", "2026-07-09.json"), "utf8")).toBe("{}");
  expect(existsSync(join(rootB, "content", "img", "2026-07-09", "cnn-01-x.jpg"))).toBe(true);
  expect(existsSync(join(rootB, "content", "market.json"))).toBe(true);
  expect(existsSync(join(rootB, "archive", "sources", "2026-07-09", "cnn", "01-x.json"))).toBe(
    true,
  );
});

test("restoreState is a no-op when no state blob exists", async () => {
  const backing = mkdtempSync(join(tmpdir(), "gt-blob-"));
  const store = createFakeBlobStore(backing);
  const root = mkdtempSync(join(tmpdir(), "gt-root-"));
  const res = await restoreState(store, { root, tmpTar: join(root, "state.tar.gz") });
  expect(res.restored).toBe(false);
});
