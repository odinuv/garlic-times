import { test, expect } from "bun:test";
import { htmlHasDate, checkLiveSite } from "@/deploy/smoke";

test("htmlHasDate detects the dated edition path", () => {
  expect(htmlHasDate('<a href="/2026-07-09/1/">like</a>', "2026-07-09")).toBe(true);
  expect(htmlHasDate("<p>no date here</p>", "2026-07-09")).toBe(false);
});

test("checkLiveSite passes when the dated page contains the date", async () => {
  const fetchText = async (url: string) => {
    expect(url).toBe("https://example.pages.dev/2026-07-09/");
    return '<a href="/2026-07-09/1/">x</a>';
  };
  await checkLiveSite({ baseUrl: "https://example.pages.dev", date: "2026-07-09", fetchText });
});

test("checkLiveSite retries then throws when the date never appears", async () => {
  let calls = 0;
  const fetchText = async () => {
    calls++;
    return "<p>stale</p>";
  };
  const sleep = async () => {};
  await expect(
    checkLiveSite({
      baseUrl: "https://example.pages.dev",
      date: "2026-07-09",
      fetchText,
      attempts: 3,
      sleep,
    }),
  ).rejects.toThrow(/smoke check failed after 3 attempts/);
  expect(calls).toBe(3);
});
