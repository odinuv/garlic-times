import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { todayIso, authorEdition } from "../../scripts/author-edition";
import { parseEdition } from "@/edition/schema";

const FIX = join(import.meta.dir, "..", "fixtures", "pipeline");

test("todayIso formats a date as YYYY-MM-DD", () => {
  expect(todayIso(new Date(Date.UTC(2026, 5, 28)))).toBe("2026-06-28");
});

test("authorEdition writes a schema-valid edition JSON and returns its path", () => {
  const out = mkdtempSync(join(tmpdir(), "gt-author-"));
  mkdirSync(join(out, "src"), { recursive: true });
  const path = authorEdition({ date: "2026-01-31", contentDir: FIX, outDir: join(out, "src") });
  expect(path).toBe(join(out, "src", "2026-01-31.json"));
  expect(existsSync(path)).toBe(true);
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  expect(() => parseEdition(parsed, "written.json")).not.toThrow();
  expect(parsed.date).toBe("2026-01-31");
});
