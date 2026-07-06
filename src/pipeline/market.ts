import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Edition } from "@/edition/schema";

export type Series = { price: number; prevClose: number };
export type BasketKey = "corn" | "crude" | "copper" | "cny";
export type MarketSnapshot = {
  fetchedAt: string;
  source: "yahoo" | "carry-forward" | "synthetic";
  series: Record<BasketKey | "eurusd", Series>;
};

// Fixed reference levels (~"1920=100"): normalize each series to price/baseline
// so the index needs no price history.
export const BASELINE: Record<BasketKey, number> = { corn: 450, crude: 75, copper: 4.2, cny: 7.2 };
const WEIGHTS: Record<BasketKey, number> = { corn: 0.4, crude: 0.3, copper: 0.15, cny: 0.15 };
const BASE_GARLIC_USD = 3.0; // garlic USD/kg at index 100

const BASKET: BasketKey[] = ["corn", "crude", "copper", "cny"];
const MOVER_LABEL: Record<BasketKey, string> = {
  corn: "Corn, Chicago",
  crude: "Crude Oil",
  copper: "Copper",
  cny: "Chinese Yuan",
};
const MOVER_DECIMALS: Record<BasketKey, number> = { corn: 1, crude: 2, copper: 2, cny: 2 };

export function gpi(prices: Record<BasketKey, number>): number {
  return 100 * BASKET.reduce((sum, k) => sum + WEIGHTS[k] * (prices[k] / BASELINE[k]), 0);
}

function signedPct(fraction: number): string {
  const pct = fraction * 100;
  const sign = pct < 0 ? "−" : "+"; // U+2212 minus to match the vintage style
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}

function deltaOf(s: Series): number {
  return (s.price - s.prevClose) / s.prevClose;
}

export function computeRates(m: MarketSnapshot): Edition["rates"] {
  const at = (pick: (s: Series) => number) => ({
    corn: pick(m.series.corn),
    crude: pick(m.series.crude),
    copper: pick(m.series.copper),
    cny: pick(m.series.cny),
  });

  const gpiToday = gpi(at((s) => s.price));
  const gpiPrev = gpi(at((s) => s.prevClose));
  const usd = (BASE_GARLIC_USD * gpiToday) / 100;
  const eur = usd / m.series.eurusd.price;

  const movers = [...BASKET]
    .sort(
      (a, b) =>
        Math.abs(deltaOf(m.series[b])) - Math.abs(deltaOf(m.series[a])) ||
        BASKET.indexOf(a) - BASKET.indexOf(b),
    )
    .slice(0, 2);

  return {
    title: "The Garlic Market",
    lead: {
      label: "Garlic, per kg",
      usd: `$${usd.toFixed(2)}`,
      eur: `€${eur.toFixed(2)}`,
      delta: signedPct((gpiToday - gpiPrev) / gpiPrev),
    },
    rows: movers.map((k) => ({
      label: MOVER_LABEL[k],
      value: m.series[k].price.toFixed(MOVER_DECIMALS[k]),
      delta: signedPct(deltaOf(m.series[k])),
    })),
  };
}

const seriesSchema = z.object({ price: z.number(), prevClose: z.number() });
const marketSnapshotSchema = z.object({
  fetchedAt: z.string(),
  source: z.enum(["yahoo", "carry-forward", "synthetic"]),
  series: z.object({
    corn: seriesSchema,
    crude: seriesSchema,
    copper: seriesSchema,
    cny: seriesSchema,
    eurusd: seriesSchema,
  }),
});

export function loadMarket(contentDir: string): MarketSnapshot {
  const p = join(contentDir, "market.json");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`loadMarket: cannot read ${p}: ${e}`);
  }
  const parsed = marketSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`loadMarket: invalid ${p}: ${parsed.error.message}`);
  }
  return parsed.data;
}
