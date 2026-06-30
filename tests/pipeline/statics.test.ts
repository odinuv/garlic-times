import { test, expect } from "bun:test";
import { formatDisplayDate, staticFields } from "@/pipeline/statics";

test("formatDisplayDate renders the period long-date style", () => {
  expect(formatDisplayDate("2026-06-28")).toBe("Sunday June 28, 2026");
  expect(formatDisplayDate("2026-01-01")).toBe("Thursday January 1, 2026");
});

test("staticFields provides masthead, rates, advert and date-derived fields", () => {
  const f = staticFields("2026-06-28");
  expect(f.masthead).toEqual({
    the: "The",
    middle: "Garlic",
    end: "Times",
    glyph: "/static/new-logo.png",
  });
  expect(f.displayDate).toBe("Sunday June 28, 2026");
  expect(f.strapline).toContain("Sunday June 28, 2026");
  expect(f.rates.rows.length).toBeGreaterThan(0);
  expect(f.advert.src).toBeTruthy();
  expect(f.meta.title).toContain("The Garlic Times");
});
