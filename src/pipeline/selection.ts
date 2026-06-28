import type { Source, SourceStory, Slot } from "@/pipeline/types";

export function dayOfYear(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const start = Date.UTC(y, 0, 0);
  const current = Date.UTC(y, m - 1, d);
  return Math.round((current - start) / 86400000);
}

export function parityIsOdd(date: string): boolean {
  return dayOfYear(date) % 2 === 1;
}

// Fixed slot shapes; only the sources flip with parity.
const SHAPES: Omit<Slot, "source">[] = [
  { position: 1, size: "xl", columns: 2, hasImage: true },
  { position: 2, size: "lg", columns: 2, hasImage: true },
  { position: 3, size: "md", columns: 2, hasImage: false },
  { position: 4, size: "md", columns: 2, hasImage: false },
  { position: 5, size: "md", columns: 2, hasImage: false },
];

export function assignSlots(date: string): Slot[] {
  const odd = parityIsOdd(date);
  const main: Source = odd ? "fox" : "cnn";
  const secondary: Source = odd ? "cnn" : "fox";
  // positions 1..5 → [main, secondary, main, main, secondary]
  const order: Source[] = [main, secondary, main, main, secondary];
  return SHAPES.map((shape, i) => ({ ...shape, source: order[i] }));
}

export function pickStories(
  slots: Slot[],
  pools: Record<Source, SourceStory[]>,
  rng: () => number,
): SourceStory[] {
  // Copy pools so we can remove picked stories without mutating the caller's arrays.
  const remaining: Record<Source, SourceStory[]> = {
    fox: [...pools.fox],
    cnn: [...pools.cnn],
  };
  return slots.map((slot) => {
    const pool = remaining[slot.source];
    if (pool.length === 0) {
      throw new Error(
        `Not enough "${slot.source}" stories: need one for slot ${slot.position} but pool is empty`,
      );
    }
    const idx = Math.floor(rng() * pool.length);
    return pool.splice(idx, 1)[0];
  });
}
