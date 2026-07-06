import { test, expect } from "bun:test";
import { formatDisplayDate, staticFields, editionNumber } from "@/pipeline/statics";
import type { MarketSnapshot } from "@/pipeline/market";

const MARKET: MarketSnapshot = {
  fetchedAt: "x",
  source: "yahoo",
  series: {
    corn: { price: 455, prevClose: 450 },
    crude: { price: 74, prevClose: 75 },
    copper: { price: 4.2, prevClose: 4.18 },
    cny: { price: 7.2, prevClose: 7.2 },
    eurusd: { price: 1.08, prevClose: 1.079 },
  },
};

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
  const f = staticFields("2026-06-28", MARKET);
  expect(f.masthead).toEqual({
    the: "The",
    middle: "Garlic",
    end: "Times",
    glyph: "/static/new-logo.png",
  });
  expect(f.displayDate).toBe("Sunday June 28, 2026");
  expect(f.strapline).toContain("Sunday June 28, 2026");
  expect(f.rates.title).toBe("The Garlic Market");
  expect(f.rates.lead.usd).toMatch(/^\$\d/);
  expect(f.rates.lead.eur).toMatch(/^€\d/);
  expect(f.rates.rows).toHaveLength(2);
  expect(f.advert.src).toBeTruthy();
  expect(f.meta.title).toContain("The Garlic Times");
});
