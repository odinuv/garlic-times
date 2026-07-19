import type { Source } from "@/pipeline/types";
import type { ScoredCandidate, Pick, Quota, SelectionResult } from "@/newsletter/types";
import { WEEKDAY_ORDER } from "@/newsletter/week";

// Highest score first; ties broken by earlier weekday, then lower article number,
// so output is fully deterministic.
function byQuality(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  const wa = WEEKDAY_ORDER[a.weekday] ?? 9;
  const wb = WEEKDAY_ORDER[b.weekday] ?? 9;
  if (wa !== wb) return wa - wb;
  return a.number - b.number;
}

export function selectPicks(scored: ScoredCandidate[], quota: Quota): SelectionResult {
  const fallbacksApplied: string[] = [];
  const bySource: Record<Source, ScoredCandidate[]> = { cnn: [], fox: [] };
  for (const s of scored) bySource[s.source].push(s);
  for (const src of ["cnn", "fox"] as Source[]) bySource[src].sort(byQuality);

  const chosen: ScoredCandidate[] = [];
  const usedDays = new Set<string>();
  const isChosen = (c: ScoredCandidate) => chosen.includes(c);

  // Process the minority-quota source first so its best days aren't stolen by
  // the majority source (matches the "Fox first" example on an odd week).
  const order = (["cnn", "fox"] as Source[]).sort((a, b) => quota[a] - quota[b]);

  for (const source of order) {
    let need = quota[source];
    // Phase 1: best articles on not-yet-used weekdays (global one-per-day).
    for (const c of bySource[source]) {
      if (need <= 0) break;
      if (usedDays.has(c.date)) continue;
      chosen.push(c);
      usedDays.add(c.date);
      need--;
    }
    // Phase 2: relax one-per-day — take remaining same-source even on used days.
    for (const c of bySource[source]) {
      if (need <= 0) break;
      if (isChosen(c)) continue;
      chosen.push(c);
      need--;
      fallbacksApplied.push(`relaxed one-per-day: took ${c.id} for ${source}`);
    }
  }

  // Phase 3: borrow from the other source to fill any remaining slots.
  const target = quota.cnn + quota.fox;
  if (chosen.length < target) {
    const rest = [...bySource.cnn, ...bySource.fox].filter((c) => !isChosen(c)).sort(byQuality);
    for (const c of rest) {
      if (chosen.length >= target) break;
      chosen.push(c);
      fallbacksApplied.push(`borrowed ${c.source} pick ${c.id} to fill quota`);
    }
  }

  // Phase 4: send-fewer is implicit — `chosen` may be shorter than target.
  const ordered = [...chosen].sort(
    (a, b) => WEEKDAY_ORDER[a.weekday] - WEEKDAY_ORDER[b.weekday] || a.number - b.number,
  );
  const picks: Pick[] = ordered.map((c, i) => ({ ...c, rank: i + 1 }));
  return { picks, fallbacksApplied };
}
