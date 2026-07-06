import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mulberry32, seedFromDate } from "@/pipeline/rng";
import {
  BASELINE,
  loadMarket,
  type BasketKey,
  type MarketSnapshot,
  type Series,
} from "@/pipeline/market";

export const YAHOO_TICKERS: Record<BasketKey | "eurusd", string> = {
  corn: "ZC=F",
  crude: "CL=F",
  copper: "HG=F",
  cny: "CNY=X",
  eurusd: "EURUSD=X",
};

const KEYS = ["corn", "crude", "copper", "cny", "eurusd"] as const;

export type FetchJson = (url: string) => Promise<unknown>;

const defaultFetchJson: FetchJson = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${url}`);
  return res.json();
};

export function parseChart(json: unknown): Series {
  const meta = (json as { chart?: { result?: { meta?: Record<string, unknown> }[] } })?.chart
    ?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const prevClose = meta?.chartPreviousClose;
  if (typeof price !== "number" || typeof prevClose !== "number") {
    throw new Error("Yahoo chart payload missing regularMarketPrice/chartPreviousClose");
  }
  return { price, prevClose };
}

// Deliberately short: 3 quick attempts, not the heavy exponential Gemini backoff.
async function shortRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 300): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

const url = (ticker: string) => `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`;

function synthesize(date: string): MarketSnapshot["series"] {
  const rng = mulberry32(seedFromDate(date));
  const jitter = (base: number): Series => {
    const prevClose = base * (1 + (rng() - 0.5) * 0.06); // ±3%
    const price = prevClose * (1 + (rng() - 0.5) * 0.04); // ±2% vs prev close
    return { price, prevClose };
  };
  return {
    corn: jitter(BASELINE.corn),
    crude: jitter(BASELINE.crude),
    copper: jitter(BASELINE.copper),
    cny: jitter(BASELINE.cny),
    eurusd: jitter(1.08),
  };
}

export async function fetchMarket(opts: {
  contentDir: string;
  date: string;
  fetchJson?: FetchJson;
  now?: () => string;
}): Promise<MarketSnapshot> {
  const fetchJson = opts.fetchJson ?? defaultFetchJson;
  const now = opts.now ?? (() => new Date().toISOString());
  const path = join(opts.contentDir, "market.json");

  try {
    const series = {} as MarketSnapshot["series"];
    for (const k of KEYS) {
      series[k] = await shortRetry(() => fetchJson(url(YAHOO_TICKERS[k])).then(parseChart));
    }
    const snap: MarketSnapshot = { fetchedAt: now(), source: "yahoo", series };
    writeFileSync(path, JSON.stringify(snap, null, 2) + "\n");
    return snap;
  } catch (err) {
    // Live fetch failed. Prefer a coherent prior snapshot over a half-populated
    // live one; validate it (a corrupt/stale file falls through to synthesize).
    if (existsSync(path)) {
      try {
        const prev = loadMarket(opts.contentDir);
        console.warn(`fetchMarket: live fetch failed (${err}); carrying forward ${path}`);
        return { ...prev, source: "carry-forward" };
      } catch (readErr) {
        console.warn(`fetchMarket: existing ${path} is unreadable (${readErr}); synthesizing`);
      }
    } else {
      console.warn(`fetchMarket: live fetch failed (${err}) and no prior snapshot; synthesizing`);
    }
    const snap: MarketSnapshot = {
      fetchedAt: now(),
      source: "synthetic",
      series: synthesize(opts.date),
    };
    writeFileSync(path, JSON.stringify(snap, null, 2) + "\n");
    return snap;
  }
}
