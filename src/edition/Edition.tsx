import React from "react";
import type { Edition } from "@/edition/schema";
import { ArticleBlock, AdvertBox, RatesBox, RecipeBox, Rule } from "@/edition/components";

export function EditionPage({
  edition,
  prevDate,
  nextDate,
}: {
  edition: Edition;
  prevDate: string | null;
  nextDate: string | null;
}) {
  const { masthead, articles } = edition;
  // Column flow mirrors the original front page:
  // article[0], rates, article[1], advert, article[2..], recipe.
  const [lead, second, ...rest] = articles;

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      <header>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] sm:text-[11px]">
          <span>{edition.editionNo}</span>
          <span className="hidden sm:inline">Late London Edition</span>
          <span>{edition.price}</span>
        </div>
        <Rule />
        <h1 className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 font-serif font-bold leading-none">
          <span className="text-2xl sm:text-5xl md:text-7xl">{masthead.the}</span>
          <span className="text-2xl sm:text-5xl md:text-7xl italic">{masthead.middle}</span>
          <img
            src={masthead.glyph}
            alt="The Garlic Times emblem"
            width={120}
            height={120}
            className="h-10 w-10 sm:h-20 sm:w-20 md:h-24 md:w-24 object-contain shrink-0"
          />
          <span className="text-2xl sm:text-5xl md:text-7xl">{masthead.end}</span>
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

      <section className="columns-1 md:columns-2 lg:columns-3 gap-8 [column-rule:1px_solid_var(--ink)] [&>*]:break-inside-avoid [&>*]:mb-6">
        {lead && <ArticleBlock article={lead} />}
        <RatesBox rates={edition.rates} />
        {second && <ArticleBlock article={second} />}
        <AdvertBox advert={edition.advert} />
        {rest.map((a, i) => (
          <ArticleBlock key={i} article={a} />
        ))}
        <RecipeBox recipe={edition.recipe} />
      </section>

      <Rule thick />
      <footer className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] sm:text-[11px]">
        <span>Printed and Published in London</span>
        <a href="/about/" className="no-underline">
          © The Garlic Times Newspapers
        </a>
        <span>Page 1</span>
      </footer>
    </main>
  );
}
