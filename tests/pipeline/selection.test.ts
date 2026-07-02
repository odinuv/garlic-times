import { test, expect } from "bun:test";
import { dayOfYear, parityIsOdd, assignSlots, pickStories } from "@/pipeline/selection";
import type { Source, SourceStory } from "@/pipeline/types";

test("dayOfYear and parity alternate across a month boundary", () => {
  expect(dayOfYear("2026-01-01")).toBe(1);
  expect(dayOfYear("2026-01-31")).toBe(31);
  expect(dayOfYear("2026-02-01")).toBe(32);
  // day-of-month would give 31 (odd) then 1 (odd); day-of-year truly alternates:
  expect(parityIsOdd("2026-01-31")).toBe(true);
  expect(parityIsOdd("2026-02-01")).toBe(false);
});

test("odd day assigns Fox to slots 1,3,4 and CNN to 2,5", () => {
  const slots = assignSlots("2026-01-31"); // day 31, odd
  expect(slots.map((s) => s.source)).toEqual(["fox", "cnn", "fox", "fox", "cnn"]);
  expect(slots.map((s) => s.size)).toEqual(["xl", "lg", "md", "md", "md"]);
  expect(slots.map((s) => s.hasImage)).toEqual([true, true, false, false, false]);
  expect(slots.map((s) => s.position)).toEqual([1, 2, 3, 4, 5]);
  expect(slots.every((s) => s.columns === 1)).toBe(true);
  expect(slots.filter((s) => s.source === "fox")).toHaveLength(3);
  expect(slots.filter((s) => s.source === "cnn")).toHaveLength(2);
});

test("even day swaps the sources", () => {
  const slots = assignSlots("2026-02-01"); // day 32, even
  expect(slots.map((s) => s.source)).toEqual(["cnn", "fox", "cnn", "cnn", "fox"]);
  expect(slots.filter((s) => s.source === "cnn")).toHaveLength(3);
  expect(slots.filter((s) => s.source === "fox")).toHaveLength(2);
});

test("pickStories returns one distinct story per slot from its source pool", () => {
  const mk = (source: Source, n: number): SourceStory => ({
    source,
    headline: `${source}-${n}`,
    body: [`${source} summary ${n}`],
  });
  const pools: Record<Source, SourceStory[]> = {
    fox: [mk("fox", 1), mk("fox", 2), mk("fox", 3)],
    cnn: [mk("cnn", 1), mk("cnn", 2), mk("cnn", 3)],
  };
  const slots = assignSlots("2026-01-31"); // fox x3, cnn x2
  const rng = () => 0; // deterministic: always picks first remaining
  const picked = pickStories(slots, pools, rng);
  expect(picked).toHaveLength(5);
  expect(picked.map((p) => p.source)).toEqual(["fox", "cnn", "fox", "fox", "cnn"]);
  const foxHeadlines = picked.filter((p) => p.source === "fox").map((p) => p.headline);
  expect(new Set(foxHeadlines).size).toBe(3); // distinct
});

test("pickStories fills image slots with image-bearing stories when the source has one", () => {
  const img = { src: "/img/x.jpg", alt: "x" };
  const pools: Record<Source, SourceStory[]> = {
    // image-bearing story is NOT at index 0, so rng=()=>0 would miss it without the preference
    fox: [
      { source: "fox", headline: "f-noimg-1", body: ["s"] },
      { source: "fox", headline: "f-img", body: ["s"], image: img },
      { source: "fox", headline: "f-noimg-2", body: ["s"] },
    ],
    cnn: [
      { source: "cnn", headline: "c-img", body: ["s"], image: img },
      { source: "cnn", headline: "c-noimg", body: ["s"] },
    ],
  };
  const slots = assignSlots("2026-01-31"); // odd: [fox,cnn,fox,fox,cnn]; slots 1 & 2 carry images
  const picked = pickStories(slots, pools, () => 0);
  // image slots (1 & 2) get the image-bearing story from their source
  expect(picked[0].image).toBeTruthy();
  expect(picked[0].headline).toBe("f-img");
  expect(picked[1].image).toBeTruthy();
  expect(picked[1].headline).toBe("c-img");
  // remaining (non-image) slots get the leftover image-less stories
  expect(picked.slice(2).every((p) => !p.image)).toBe(true);
});

test("pickStories falls back to any story when an image slot's source has no image-bearing story", () => {
  const pools: Record<Source, SourceStory[]> = {
    fox: [
      { source: "fox", headline: "f1", body: ["s"] },
      { source: "fox", headline: "f2", body: ["s"] },
      { source: "fox", headline: "f3", body: ["s"] },
    ],
    cnn: [
      { source: "cnn", headline: "c1", body: ["s"] },
      { source: "cnn", headline: "c2", body: ["s"] },
    ],
  };
  const slots = assignSlots("2026-01-31");
  const picked = pickStories(slots, pools, () => 0);
  // no images anywhere → still returns 5 distinct stories, image slots simply have none
  expect(picked).toHaveLength(5);
  expect(picked.every((p) => !p.image)).toBe(true);
  expect(new Set(picked.map((p) => p.headline)).size).toBe(5);
});

test("pickStories throws when a pool is too small for its slots", () => {
  const pools: Record<Source, SourceStory[]> = {
    fox: [{ source: "fox", headline: "f1", body: ["s"] }], // only 1, need 3
    cnn: [
      { source: "cnn", headline: "c1", body: ["s"] },
      { source: "cnn", headline: "c2", body: ["s"] },
    ],
  };
  const slots = assignSlots("2026-01-31");
  expect(() => pickStories(slots, pools, () => 0)).toThrow(/fox/);
});
