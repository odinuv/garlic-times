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
  expect(html).toContain("Crude Oil");
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

test("each article links to its original source with a >> marker", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  // lead article has sourceUrl → renders the source link
  expect(html).toContain('href="https://example.com/original"');
  expect(html).toContain('aria-label="Read the original article"');
  // only the one article with a sourceUrl gets a link (others omit it)
  expect((html.match(/Read the original article/g) || []).length).toBe(1);
});

test("each article has a numbered anchor id", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  // validEdition has 5 articles → article-1 … article-5
  for (let n = 1; n <= 5; n++) {
    expect(html).toContain(`id="article-${n}"`);
  }
});

test("each article has a thumbs-up like link to /<date>/<n>/", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  for (let n = 1; n <= 5; n++) {
    expect(html).toContain(`href="/2026-06-27/${n}/"`);
  }
  expect(html).toContain('src="/static/thumbs-up.png"');
  expect(html).toContain('aria-label="Like this article"');
  // one like link per article
  expect((html.match(/aria-label="Like this article"/g) || []).length).toBe(5);
});

test("each article has a one-click share affordance", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  // one share control per article (5)
  expect((html.match(/aria-label="Share this article"/g) || []).length).toBe(5);
  expect((html.match(/class="js-share/g) || []).length).toBe(5);
  // no-JS fallback: X/Twitter compose link carrying an absolute deep URL
  expect(html).toContain("https://twitter.com/intent/tweet?text=");
  expect(html).toContain(
    encodeURIComponent("https://www.thegarlictimes.com/2026-06-27/#article-1"),
  );
  // data hooks the enhancement script reads to open the native share sheet
  expect(html).toContain('data-share-url="https://www.thegarlictimes.com/2026-06-27/#article-1"');
});

test("edition page ships the share-enhancement script", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  expect(html).toContain("navigator.share");
});
