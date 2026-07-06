import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchMarket, parseChart, type FetchJson } from "@/ingest/market";

const chart = (price: number, prevClose: number) => ({
  chart: { result: [{ meta: { regularMarketPrice: price, chartPreviousClose: prevClose } }] },
});

test("parseChart extracts price and previous close", () => {
  expect(parseChart(chart(100, 99))).toEqual({ price: 100, prevClose: 99 });
  expect(() => parseChart({})).toThrow();
});

test("fetchMarket writes a live snapshot when Yahoo responds", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gt-mkt-"));
  const fetchJson: FetchJson = async (url) =>
    url.includes("ZC=F") ? chart(455, 450) : chart(10, 10);
  const snap = await fetchMarket({
    contentDir: dir,
    date: "2026-07-06",
    fetchJson,
    now: () => "T",
  });
  expect(snap.source).toBe("yahoo");
  expect(snap.series.corn).toEqual({ price: 455, prevClose: 450 });
  expect(existsSync(join(dir, "market.json"))).toBe(true);
});

test("fetchMarket carries forward the last snapshot when the fetch fails", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gt-mkt-"));
  const prior = {
    fetchedAt: "yesterday",
    source: "yahoo",
    series: {
      corn: { price: 1, prevClose: 1 },
      crude: { price: 2, prevClose: 2 },
      copper: { price: 3, prevClose: 3 },
      cny: { price: 4, prevClose: 4 },
      eurusd: { price: 1.1, prevClose: 1.1 },
    },
  };
  writeFileSync(join(dir, "market.json"), JSON.stringify(prior));
  const fetchJson: FetchJson = async () => {
    throw new Error("down");
  };
  const snap = await fetchMarket({ contentDir: dir, date: "2026-07-06", fetchJson });
  expect(snap.source).toBe("carry-forward");
  expect(snap.series.corn).toEqual({ price: 1, prevClose: 1 });
  // carry-forward must NOT rewrite the on-disk snapshot
  expect(JSON.parse(readFileSync(join(dir, "market.json"), "utf8")).source).toBe("yahoo");
});

test("fetchMarket synthesizes deterministically when there is no prior file", async () => {
  const dirA = mkdtempSync(join(tmpdir(), "gt-mkt-"));
  const dirB = mkdtempSync(join(tmpdir(), "gt-mkt-"));
  const fetchJson: FetchJson = async () => {
    throw new Error("down");
  };
  const a = await fetchMarket({ contentDir: dirA, date: "2026-07-06", fetchJson });
  const b = await fetchMarket({ contentDir: dirB, date: "2026-07-06", fetchJson });
  expect(a.source).toBe("synthetic");
  expect(a.series).toEqual(b.series); // deterministic from the date seed
  expect(JSON.parse(readFileSync(join(dirA, "market.json"), "utf8")).source).toBe("synthetic");
});

test("fetchMarket synthesizes when the existing snapshot is corrupt", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gt-mkt-"));
  writeFileSync(join(dir, "market.json"), JSON.stringify({ source: "yahoo" })); // wrong shape
  const fetchJson: FetchJson = async () => {
    throw new Error("down");
  };
  const snap = await fetchMarket({ contentDir: dir, date: "2026-07-06", fetchJson });
  expect(snap.source).toBe("synthetic");
});
