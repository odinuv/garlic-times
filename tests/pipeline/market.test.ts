import { test, expect } from "bun:test";
import { computeRates, gpi, type MarketSnapshot } from "@/pipeline/market";

const snap: MarketSnapshot = {
  fetchedAt: "x",
  source: "yahoo",
  series: {
    corn: { price: 495, prevClose: 450 }, // +10%
    crude: { price: 75, prevClose: 75 }, // 0%
    copper: { price: 4.2, prevClose: 4.2 }, // 0%
    cny: { price: 7.2, prevClose: 7.2 }, // 0%
    eurusd: { price: 1.0, prevClose: 1.0 },
  },
};

test("gpi weights the basket against fixed baselines (100 at baseline)", () => {
  expect(gpi({ corn: 450, crude: 75, copper: 4.2, cny: 7.2 })).toBeCloseTo(100, 6);
});

test("computeRates builds the garlic lead and top-2 movers", () => {
  const rates = computeRates(snap);
  expect(rates.title).toBe("The Garlic Market");
  expect(rates.lead).toEqual({
    label: "Garlic, per kg",
    usd: "$3.12", // 3.00 * 104/100
    eur: "€3.12", // usd / 1.0
    delta: "+4.0%", // (104 - 100) / 100
  });
  // corn (+10%) is the top mover; the three flat series tie, broken by basket order → crude next
  expect(rates.rows).toEqual([
    { label: "Corn, Chicago", value: "495.0", delta: "+10.0%" },
    { label: "Crude Oil", value: "75.00", delta: "+0.0%" },
  ]);
});
