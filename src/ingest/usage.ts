// src/ingest/usage.ts
// Token-usage accounting for the Gemini ingest stages, plus report formatting.
// Prices are USD per 1,000,000 tokens — edit PRICES if Google changes pricing.
import type { Source } from "@/pipeline/types";

export interface UsageRow {
  stage: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
};

export function costFor(model: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

export class UsageTracker {
  private byKey = new Map<string, UsageRow>();

  record(stage: string, model: string, inputTokens: number, outputTokens: number): void {
    const key = `${stage} ${model}`;
    const existing = this.byKey.get(key);
    if (existing) {
      existing.calls += 1;
      existing.inputTokens += inputTokens;
      existing.outputTokens += outputTokens;
    } else {
      this.byKey.set(key, { stage, model, calls: 1, inputTokens, outputTokens });
    }
  }

  rows(): UsageRow[] {
    return [...this.byKey.values()];
  }
}

function fmtCost(c: number | null): string {
  return c === null ? "n/a" : `$${c.toFixed(4)}`;
}

export function formatUsageTable(tracker: UsageTracker): string {
  const rows = tracker.rows();
  const out: string[] = ["━━ Gemini usage ━━"];
  let tIn = 0;
  let tOut = 0;
  let tCost = 0;
  let tCalls = 0;
  let anyUnknown = false;
  for (const r of rows) {
    const c = costFor(r.model, r.inputTokens, r.outputTokens);
    if (c === null) anyUnknown = true;
    else tCost += c;
    tIn += r.inputTokens;
    tOut += r.outputTokens;
    tCalls += r.calls;
    out.push(
      `${r.stage.padEnd(13)} ${r.model.padEnd(22)} ${String(r.calls).padStart(3)}  ` +
        `${r.inputTokens.toLocaleString("en-US").padStart(9)} in  ` +
        `${r.outputTokens.toLocaleString("en-US").padStart(8)} out  ${fmtCost(c)}`,
    );
  }
  out.push(
    `${"Total".padEnd(13)} ${"".padEnd(22)} ${String(tCalls).padStart(3)}  ` +
      `${tIn.toLocaleString("en-US").padStart(9)} in  ${tOut.toLocaleString("en-US").padStart(8)} out  ` +
      `${fmtCost(tCost)}${anyUnknown ? " (+unknown-priced models)" : ""}`,
  );
  return out.join("\n");
}

export interface SelectionEntry {
  source: Source;
  garlicTitle: string;
  picked: boolean;
}

export function formatSelection(entries: SelectionEntry[]): string {
  const out: string[] = ["━━ Selection (garlic titles; ★ = picked) ━━"];
  const sources = [...new Set(entries.map((e) => e.source))];
  for (const source of sources) {
    const group = entries.filter((e) => e.source === source);
    const picked = group.filter((e) => e.picked).length;
    out.push(`${source.toUpperCase()} — ${group.length} candidates, ${picked} picked`);
    for (const e of group) {
      out.push(`  ${e.picked ? "★" : " "} ${e.garlicTitle}`);
    }
  }
  return out.join("\n");
}
