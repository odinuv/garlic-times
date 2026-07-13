import { test, expect } from "bun:test";
import { join } from "node:path";
import { buildEdition } from "@/pipeline/buildEdition";
import { parseEdition } from "@/edition/schema";

const FIX = join(import.meta.dir, "..", "fixtures", "pipeline");

test("builds a schema-valid edition with 5 articles for an odd day", () => {
  const edition = buildEdition({ date: "2026-01-31", contentDir: FIX });
  expect(() => parseEdition(edition, "built.json")).not.toThrow();
  expect(edition.date).toBe("2026-01-31");
  expect(edition.articles).toHaveLength(5);
  // odd day: fox,cnn,fox,fox,cnn — slots 1&2 have images, 3-5 do not
  expect(edition.articles[0].image).toBeTruthy();
  expect(edition.articles[1].image).toBeTruthy();
  expect(edition.articles.slice(2).every((a) => a.image === undefined)).toBe(true);
  expect(edition.articles.map((a) => a.size)).toEqual(["xl", "lg", "md", "md", "md"]);
  expect(edition.recipe.title).toBeTruthy();
  expect(edition.rates.title).toBe("The Garlic Market");
  expect(edition.rates.lead.usd).toMatch(/^\$\d/);
  expect(edition.rates.rows).toHaveLength(2);
  expect(edition.advert.src).toBeTruthy();
});

test("is reproducible for a given date (default date-seeded rng)", () => {
  const a = buildEdition({ date: "2026-01-31", contentDir: FIX });
  const b = buildEdition({ date: "2026-01-31", contentDir: FIX });
  expect(a).toEqual(b);
});
