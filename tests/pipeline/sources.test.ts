import { test, expect } from "bun:test";
import { join } from "node:path";
import { loadSourceStories } from "@/pipeline/sources";

const FIX = join(import.meta.dir, "..", "fixtures", "pipeline", "sources");

test("loads and tags stories from a source directory, sorted by filename", () => {
  const fox = loadSourceStories(FIX, "fox");
  expect(fox).toHaveLength(3);
  expect(fox.every((s) => s.source === "fox")).toBe(true);
  expect(fox.map((s) => s.headline)).toEqual(["Fox A", "Fox B", "Fox C"]);
});

test("tags stories with their directory's source", () => {
  const cnn = loadSourceStories(FIX, "cnn");
  expect(cnn).toHaveLength(3);
  expect(cnn.every((s) => s.source === "cnn")).toBe(true);
  expect(cnn.map((s) => s.headline)).toEqual(["CNN A", "CNN B", "CNN C"]);
});
