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
  expect((html.match(/aria-label="Read the original article"/g) || []).length).toBe(1);
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

test("each article has a like link to /<date>/<n>/", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  for (let n = 1; n <= 5; n++) {
    expect(html).toContain(`href="/2026-06-27/${n}/"`);
  }
  // Clip-art glyph, matching the share icon so the pair reads as one row.
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
  // clip-art share glyph, matching the like icon
  expect(html).toContain('src="/static/share-32.png"');
  // no-JS fallback: X/Twitter compose link carrying an absolute deep URL
  expect(html).toContain("https://twitter.com/intent/tweet?text=");
  expect(html).toContain(
    encodeURIComponent("https://www.thegarlictimes.com/2026-06-27/#article-1"),
  );
  // data hooks the enhancement script reads to open the native share sheet
  expect(html).toContain('data-share-url="https://www.thegarlictimes.com/2026-06-27/#article-1"');
  // data-share-text carries the publication name only — the headline is already
  // data-share-title, so native share sheets don't render the title twice.
  expect(html).toContain('data-share-title="Cabinet talks resume"');
  expect(html).toContain('data-share-text="The Garlic Times"');
});

test("edition page ships the share-enhancement script", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  expect(html).toContain("navigator.share");
});

test("mounts the newsletter signup box when a config is passed", () => {
  const html = renderToStaticMarkup(
    <EditionPage
      edition={validEdition}
      prevDate={null}
      nextDate={null}
      newsletter={{ action: "https://provider.example/subscribe", emailField: "fields[email]" }}
    />,
  );
  expect(html).toContain('action="https://provider.example/subscribe"');
  expect(html).toContain('aria-label="Subscribe"');
});

test("renders no signup box when the newsletter config is absent", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  expect(html).not.toContain('aria-label="Subscribe"');
});

const imgTag = (html: string, src: string) =>
  html.match(new RegExp(`<img[^>]*src="${src.replace(/[/.]/g, "\\$&")}"[^>]*>`))?.[0] ?? "";

test("the first photo loads eagerly at high priority (LCP); later photos stay lazy", () => {
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  // article[0] carries the first photo → it is the LCP candidate.
  const lead = imgTag(html, "/img/main.jpg");
  expect(lead).toContain('loading="eager"');
  expect(lead).toContain('fetchPriority="high"');
  expect(lead).toContain('decoding="async"');
  // article[1]'s photo must not compete for the initial-load bandwidth.
  const second = imgTag(html, "/img/second.jpg");
  expect(second).toContain('loading="lazy"');
  expect(second).not.toContain('fetchPriority="high"');
});

test("photos render intrinsic width/height to reserve layout space (zero CLS)", () => {
  const ed = {
    ...validEdition,
    articles: validEdition.articles.map((a, i) =>
      i === 0 ? { ...a, image: { ...a.image!, width: 1200, height: 800 } } : a,
    ),
  };
  const html = renderToStaticMarkup(<EditionPage edition={ed} prevDate={null} nextDate={null} />);
  const lead = imgTag(html, "/img/main.jpg");
  expect(lead).toContain('width="1200"');
  expect(lead).toContain('height="800"');
});

const emblemTag = (html: string) =>
  html.match(/<img[^>]*alt="The Garlic Times emblem"[^>]*>/)?.[0] ?? "";

test("the masthead emblem yields the high-priority hint to the lead photo", () => {
  // validEdition's lead article carries a photo, so it — not the emblem — is the
  // LCP candidate; the emblem must not compete for the hint.
  const html = renderToStaticMarkup(
    <EditionPage edition={validEdition} prevDate={null} nextDate={null} />,
  );
  const emblem = emblemTag(html);
  expect(emblem).toContain('fetchPriority="auto"');
  expect(emblem).toContain('decoding="async"');
});

test("the masthead emblem takes the high-priority hint when the lead has no photo", () => {
  // With no lead photo the emblem is the largest above-the-fold paint, so it
  // becomes the single high-priority element.
  const noPhotos = {
    ...validEdition,
    articles: validEdition.articles.map(({ image: _image, ...rest }) => rest),
  };
  const html = renderToStaticMarkup(
    <EditionPage edition={noPhotos} prevDate={null} nextDate={null} />,
  );
  expect(emblemTag(html)).toContain('fetchPriority="high"');
});
