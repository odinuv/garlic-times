import { test, expect } from "bun:test";
import { formatDisplayDate, staticFields, editionNumber } from "@/pipeline/statics";

test("formatDisplayDate renders the period long-date style", () => {
  expect(formatDisplayDate("2026-06-28")).toBe("Sunday June 28, 2026");
  expect(formatDisplayDate("2026-01-01")).toBe("Thursday January 1, 2026");
});

test("editionNumber rises over time and is formatted like a Times number", () => {
  const num = (s: string) => Number(s.replace(/[^0-9]/g, ""));
  const a = editionNumber("2026-06-28");
  const b = editionNumber("2026-06-29");
  expect(a).toMatch(/^No\. \d{1,3}(,\d{3})*$/);
  expect(num(b)).toBeGreaterThan(num(a)); // rises day over day
  expect(num(a)).toBeGreaterThan(40000); // ~50k in 2026
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
