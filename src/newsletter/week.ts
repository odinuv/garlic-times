import type { Source } from "@/pipeline/types";
import type { Weekday, Quota } from "@/newsletter/types";

// All date math is UTC and uses explicit args (never argless `new Date()`), to
// stay inside the determinism boundary.
function utc(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

/** ISO-8601 week number (the week's Thursday decides the year). */
export function isoWeek(date: string): number {
  const dt = utc(date);
  const day = dt.getUTCDay() || 7; // Sun=0 -> 7
  dt.setUTCDate(dt.getUTCDate() + 4 - day); // shift to Thursday
  const yearStart = Date.UTC(dt.getUTCFullYear(), 0, 1);
  return Math.ceil(((dt.getTime() - yearStart) / 86400000 + 1) / 7);
}

export function isoWeekIsOdd(date: string): boolean {
  return isoWeek(date) % 2 === 1;
}

const WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export const WEEKDAY_ORDER: Record<Weekday, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
};

/** The Monday..Friday ISO dates of the week containing `date`. */
export function mondayToFriday(date: string): { date: string; weekday: Weekday }[] {
  const dt = utc(date);
  const day = dt.getUTCDay() || 7; // Mon=1..Sun=7
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() - (day - 1));
  return WEEKDAYS.map((weekday, i) => {
    const cur = new Date(monday);
    cur.setUTCDate(monday.getUTCDate() + i);
    return { date: toIso(cur), weekday };
  });
}

/** The Saturday of the Mon–Sun week containing `date` (Monday + 5). This is the
 *  digest's canonical date: it is sent on and displayed as this Saturday
 *  regardless of the actual run day, so a late Sunday run still resolves to the
 *  same Saturday rather than mislabelling the issue with the run day. */
export function saturdayOf(date: string): string {
  const dt = utc(date);
  const day = dt.getUTCDay() || 7; // Mon=1..Sun=7
  const sat = new Date(dt);
  sat.setUTCDate(dt.getUTCDate() - (day - 1) + 5); // shift to Monday, then +5
  return toIso(sat);
}

/** 3/2 source split by ISO-week parity: odd -> 3 cnn/2 fox, even -> 3 fox/2 cnn. */
export function quotaForWeek(date: string): Quota {
  return isoWeekIsOdd(date) ? { cnn: 3, fox: 2 } : { cnn: 2, fox: 3 };
}
