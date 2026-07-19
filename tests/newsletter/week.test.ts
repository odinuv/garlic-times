import { test, expect } from "bun:test";
import { isoWeek, isoWeekIsOdd, mondayToFriday, quotaForWeek } from "@/newsletter/week";

test("isoWeek matches known ISO-8601 week numbers", () => {
  expect(isoWeek("2026-01-01")).toBe(1); // Thu of ISO week 1
  expect(isoWeek("2026-07-18")).toBe(29); // the Saturday from the sample crawl
});

test("mondayToFriday returns that week's five weekdays for a Saturday", () => {
  const week = mondayToFriday("2026-07-18"); // Saturday
  expect(week.map((d) => d.date)).toEqual([
    "2026-07-13",
    "2026-07-14",
    "2026-07-15",
    "2026-07-16",
    "2026-07-17",
  ]);
  expect(week.map((d) => d.weekday)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
});

test("quota flips by ISO-week parity: odd -> 3 cnn/2 fox, even -> 3 fox/2 cnn", () => {
  const odd = "2026-07-18"; // ISO week 29 (odd)
  const even = "2026-07-25"; // ISO week 30 (even)
  expect(isoWeekIsOdd(odd)).toBe(true);
  expect(quotaForWeek(odd)).toEqual({ cnn: 3, fox: 2 });
  expect(isoWeekIsOdd(even)).toBe(false);
  expect(quotaForWeek(even)).toEqual({ fox: 3, cnn: 2 });
});
