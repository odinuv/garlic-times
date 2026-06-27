import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EditionPage } from "@/edition/Edition";
import { validEdition } from "./fixtures/valid-edition";

test("renders headline, byline, rates, recipe", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  expect(html).toContain("Cabinet talks resume");
  expect(html).toContain("From our Political Correspondent");
  expect(html).toContain("Steak &amp; Kidney Pudding");
  expect(html).toContain("U.S. Dollar");
});

test("about link is in the footer", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  expect(html).toContain('href="/about/"');
  expect(html).toContain("The Garlic Times Newspapers");
});

test("shows both nav arrows with correct hrefs when neighbours exist", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate="2026-06-26" nextDate="2026-06-28" />,
  );
  expect(html).toContain('href="/2026-06-26/"');
  expect(html).toContain('href="/2026-06-28/"');
});

test("omits next arrow on the latest edition", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate="2026-06-26" nextDate={null} />,
  );
  expect(html).toContain('href="/2026-06-26/"');
  expect(html).not.toContain('href="/2026-06-28/"');
});
