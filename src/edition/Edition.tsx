import React from "react";
import type { Edition } from "@/edition/schema";
// AdvertBox import removed while the advertisement section is commented out below (re-add to restore).
import { ArticleBlock, RatesBox, RecipeBox, Rule } from "@/edition/components";
import { SubscribeBox, type NewsletterConfig } from "@/edition/subscribe";

// Progressive enhancement: when the browser supports the Web Share API, a click
// on any ".js-share" link opens the native OS share sheet instead of following
// the X/Twitter compose fallback href. No framework, no external JS — one tiny
// delegated listener. Where navigator.share is absent (most desktops) the link
// behaves as a normal one-click X compose link.
const SHARE_SCRIPT =
  'document.addEventListener("click",function(e){' +
  'var t=e.target.closest?e.target.closest(".js-share"):null;' +
  "if(!t||!navigator.share)return;e.preventDefault();" +
  'navigator.share({title:t.getAttribute("data-share-title")||document.title,' +
  'text:t.getAttribute("data-share-text")||"",' +
  'url:t.getAttribute("data-share-url")||location.href}).catch(function(){});});';

export function EditionPage({
  edition,
  prevDate,
  nextDate,
  newsletter = null,
}: {
  edition: Edition;
  prevDate: string | null;
  nextDate: string | null;
  /** Newsletter signup config; when null the SubscribeBox renders nothing. */
  newsletter?: NewsletterConfig | null;
}) {
  const { masthead, articles } = edition;
  // Column flow mirrors the original front page:
  // article[0], rates, article[1], advert, article[2..], recipe.
  const [lead, second, ...rest] = articles;
  // Only the lead article sits above the fold on mobile, so only its photo is a
  // safe largest-contentful-paint candidate to eager-load at high priority. If
  // the lead has no photo the masthead/headline is the LCP, and every photo
  // stays lazy so nothing competes with above-the-fold paint for bandwidth.
  const lcpImageIndex = articles[0]?.image ? 0 : -1;

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      <header>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] sm:text-[11px]">
          <span>{edition.editionNo}</span>
          <span className="hidden sm:inline">European Morning Edition</span>
          <span>{edition.price}</span>
        </div>
        <Rule />
        <h1 className="font-serif font-bold leading-none">
          <a
            href="/"
            aria-label="The Garlic Times — front page"
            className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 no-underline"
          >
            <span className="text-2xl sm:text-5xl md:text-7xl">{masthead.the}</span>
            <span className="text-2xl sm:text-5xl md:text-7xl italic">{masthead.middle}</span>
            <img
              src={masthead.glyph}
              alt="The Garlic Times emblem"
              width={120}
              height={120}
              fetchPriority="high"
              decoding="async"
              className="h-10 w-10 sm:h-20 sm:w-20 md:h-24 md:w-24 object-contain shrink-0"
            />
            <span className="text-2xl sm:text-5xl md:text-7xl">{masthead.end}</span>
          </a>
        </h1>
        <Rule />
        <p className="flex items-center justify-center gap-3 text-center text-[10px] uppercase tracking-[0.25em] sm:text-[12px] sm:tracking-[0.3em]">
          {prevDate ? (
            <a href={`/${prevDate}/`} aria-label="Previous edition" className="no-underline">
              ‹
            </a>
          ) : (
            <span aria-hidden className="opacity-0">
              ‹
            </span>
          )}
          <span>{edition.strapline}</span>
          {nextDate ? (
            <a href={`/${nextDate}/`} aria-label="Next edition" className="no-underline">
              ›
            </a>
          ) : (
            <span aria-hidden className="opacity-0">
              ›
            </span>
          )}
        </p>
        <Rule thick />
      </header>

      {/* Articles flow across these page columns so the columns fill evenly;
          only whole-unit blocks (boxes, photos, headlines) resist splitting. */}
      <section className="columns-1 md:columns-2 lg:columns-3 gap-8 [column-rule:1px_solid_var(--ink)] [&>*]:mb-6">
        {lead && (
          <ArticleBlock
            article={lead}
            number={1}
            date={edition.date}
            priority={lcpImageIndex === 0}
          />
        )}
        <RatesBox rates={edition.rates} />
        {second && (
          <ArticleBlock
            article={second}
            number={2}
            date={edition.date}
            priority={lcpImageIndex === 1}
          />
        )}
        {/* Advertisement section temporarily hidden (data retained in the edition schema). */}
        {/* <AdvertBox advert={edition.advert} /> */}
        {rest.map((a, i) => (
          <ArticleBlock
            key={i}
            article={a}
            number={i + 3}
            date={edition.date}
            priority={lcpImageIndex === i + 2}
          />
        ))}
        <RecipeBox recipe={edition.recipe} />
        {/* Owned-audience capture — the last box in the column flow, after the
            recipe. Renders nothing until the newsletter provider is configured. */}
        <SubscribeBox config={newsletter} />
      </section>

      <Rule thick />
      <footer className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] sm:text-[11px]">
        <span>Printed in Europe</span>
        <a href="/about/" className="no-underline">
          © The Garlic Times Newspapers
        </a>
        <span>Page 1</span>
      </footer>
      <script dangerouslySetInnerHTML={{ __html: SHARE_SCRIPT }} />
    </main>
  );
}
