// scripts/migrate-editions.ts
// Repair on-disk editions whose `rates` predate a schema change. For any edition
// in content/src/ that FAILS validation, backfill `rates` from the deterministic
// synthetic-by-date snapshot (the same fallback fetchMarket uses when Yahoo is
// down) + computeRates. Editions that already validate are left untouched, so real
// market data is never clobbered. Idempotent. Run: bun run scripts/migrate-editions.ts
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchMarket } from "@/ingest/market";
import { computeRates } from "@/pipeline/market";
import { parseEdition } from "@/edition/schema";

const srcDir = join(process.cwd(), "content", "src");
const failFetch = async () => {
  throw new Error("migrate-editions: force synthesize");
};

async function syntheticRates(date: string) {
  const tmp = mkdtempSync(join(tmpdir(), "gt-migrate-"));
  const snap = await fetchMarket({ contentDir: tmp, date, fetchJson: failFetch });
  return computeRates(snap);
}

let repaired = 0;
for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".json"))) {
  const path = join(srcDir, file);
  const ed = JSON.parse(readFileSync(path, "utf8"));
  try {
    parseEdition(ed, file);
    continue; // already valid — leave real data untouched
  } catch {
    ed.rates = await syntheticRates(file.replace(/\.json$/, ""));
    parseEdition(ed, file); // must be valid now, else throw loudly
    writeFileSync(path, JSON.stringify(ed, null, 2) + "\n");
    repaired++;
    console.log(`repaired ${file}: ${ed.rates.lead.usd} / ${ed.rates.lead.eur}`);
  }
}
console.log(repaired ? `\ndone: repaired ${repaired} edition(s)` : "all editions already valid");
