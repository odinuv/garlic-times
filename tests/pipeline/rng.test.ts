import { test, expect } from "bun:test";
import { mulberry32, seedFromDate } from "@/pipeline/rng";

test("mulberry32 is deterministic for a given seed", () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  expect(seqA).toEqual(seqB);
  for (const n of seqA) {
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThan(1);
  }
});

test("different seeds give different sequences", () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  expect(a()).not.toEqual(b());
});

test("seedFromDate is stable per date and differs across dates", () => {
  expect(seedFromDate("2026-06-28")).toEqual(seedFromDate("2026-06-28"));
  expect(seedFromDate("2026-06-28")).not.toEqual(seedFromDate("2026-06-29"));
});

test("mulberry32 produces a stable golden sequence (guards reproducibility)", () => {
  const r = mulberry32(123);
  expect(r()).toBeCloseTo(0.7872516233474016, 10);
});
