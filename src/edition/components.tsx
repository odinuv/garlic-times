import React from "react";
import type { Article, Edition, EditionImage } from "@/edition/schema";
import { renderInline } from "@/edition/inline";
import { absoluteUrl } from "@/edition/site";

export function Rule({ thick = false }: { thick?: boolean }) {
  return <hr className={`my-3 border-0 bg-ink ${thick ? "h-[3px]" : "h-px"}`} aria-hidden />;
}

const HEADLINE_SIZES = {
  sm: "text-lg leading-[1.1]",
  md: "text-xl sm:text-2xl leading-[1.05]",
  lg: "text-2xl sm:text-3xl leading-[1.05]",
  xl: "text-3xl sm:text-4xl md:text-5xl leading-[1.02]",
} as const;

export function Headline({
  children,
  size = "lg",
  className = "",
}: {
  children: React.ReactNode;
  size?: keyof typeof HEADLINE_SIZES;
  className?: string;
}) {
  return (
    <h2 className={`font-serif font-bold tracking-tight ${HEADLINE_SIZES[size]} ${className}`}>
      {children}
    </h2>
  );
}

export function ArticleBlock({
  article,
  number,
  date,
}: {
  article: Article;
  number: number;
  date: string;
}) {
  const colsClass =
    article.columns === 2 ? "sm:columns-2 sm:gap-5 [column-rule:1px_solid_var(--ink)]" : "";
  // Deep link to this article on its edition page. Absolute so it survives being
  // shared out of context (native share sheet / X compose window).
  const shareUrl = absoluteUrl(`/${date}/#article-${number}`);
  // Native share sheets render title and text as separate lines, so the text
  // must NOT repeat the headline (that's already data-share-title) — it carries
  // the publication name instead. The X compose fallback has no title field, so
  // its tweet text keeps the headline.
  const shareTagline = "The Garlic Times";
  const tweetText = `${article.title} — ${shareTagline}`;
  // No-JS fallback: a plain X/Twitter compose link (one click, works everywhere).
  // Progressively upgraded to the native share sheet by the inline script on the
  // edition page when navigator.share is available.
  const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetText,
  )}&url=${encodeURIComponent(shareUrl)}`;
  return (
    <article id={`article-${number}`} className="mb-2">
      {/* Keep the headline whole and glued to the text that follows it. */}
      <Headline size={article.size} className="mb-1 break-inside-avoid break-after-avoid">
        {article.title}
      </Headline>
      {article.byline && (
        <p className="my-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground break-after-avoid">
          {article.byline}
        </p>
      )}
      {article.image && (
        <figure className="my-3 break-inside-avoid">
          {/* Sketches are black ink on white; multiply blends the white into the
              paper so there's no visible image box, whatever the exact white. */}
          <img
            src={article.image.src}
            alt={article.image.alt}
            loading="lazy"
            className="w-full mix-blend-multiply"
          />
          {article.image.caption && (
            <figcaption className="mt-1 text-[11px] italic leading-snug text-muted-foreground">
              {article.image.caption}
            </figcaption>
          )}
        </figure>
      )}
      {/* Body text flows freely (no break-inside-avoid), so the article can
          continue across the page columns and fill them evenly. */}
      <div className={`text-[13.5px] leading-[1.45] [&>p]:mb-3 ${colsClass}`}>
        {article.body.map((p, i) => {
          const isLast = i === article.body.length - 1;
          return (
            <p key={i}>
              {renderInline(p)}
              {article.sourceUrl && isLast && (
                <>
                  {" "}
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold no-underline"
                    aria-label="Read the original article"
                    title="Read the original article"
                  >
                    {">>"}
                  </a>
                </>
              )}
            </p>
          );
        })}
      </div>
      {/* Engagement actions get their own right-aligned row after the body, not
          floated into the prose — so they never crowd the ">>" source link or
          drop into the column gutter. Both are matching 32px clip-art glyphs so
          the pair reads as one consistent row. The anchors carry the labels, so
          the icons themselves are decorative (empty alt). */}
      <div className="mt-1 flex items-center justify-end gap-3">
        <a
          href={`/${date}/${number}/`}
          aria-label="Like this article"
          title="Like this article"
          className="no-underline"
        >
          <img
            src="/static/thumbs-up.png"
            alt=""
            loading="lazy"
            className="inline-block h-5 w-5 mix-blend-multiply"
          />
        </a>
        {/* One-click share. Falls back to an X compose link with no JS; the
            edition page's inline script upgrades it to the native share sheet. */}
        <a
          href={xShareUrl}
          data-share-url={shareUrl}
          data-share-title={article.title}
          data-share-text={shareTagline}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share this article"
          title="Share this article"
          className="js-share no-underline"
        >
          <img
            src="/static/share-32.png"
            alt=""
            loading="lazy"
            className="inline-block h-5 w-5 mix-blend-multiply"
          />
        </a>
      </div>
    </article>
  );
}

export function RatesBox({ rates }: { rates: Edition["rates"] }) {
  return (
    <article className="border border-ink p-3 break-inside-avoid">
      <p className="mb-1 text-center text-[10px] uppercase tracking-[0.25em]">{rates.title}</p>
      <Rule />
      <div className="my-2 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em]">{rates.lead.label}</p>
        <p className="text-[15px] font-semibold tabular-nums">
          {rates.lead.usd} <span className="text-muted-foreground">/</span> {rates.lead.eur}{" "}
          <span className="text-[12px] text-muted-foreground">{rates.lead.delta}</span>
        </p>
      </div>
      <Rule />
      <table className="w-full text-[13px]">
        <tbody>
          {rates.rows.map((row, i) => (
            <tr key={i} className={i < rates.rows.length - 1 ? "border-b border-ink/30" : ""}>
              <td className="py-1">{row.label}</td>
              <td className="py-1 text-right tabular-nums">{row.value}</td>
              <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">
                {row.delta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

export function RecipeBox({ recipe }: { recipe: Edition["recipe"] }) {
  return (
    <article className="border border-ink p-4 break-inside-avoid">
      <p className="text-center text-[11px] uppercase tracking-[0.25em]">{recipe.kicker}</p>
      <Rule />
      <h3 className="text-center font-serif text-2xl font-bold leading-tight">{recipe.title}</h3>
      <p className="mb-2 text-center text-[11px] italic">{recipe.meta}</p>
      <Rule />
      <div className="space-y-2 text-[13px] leading-snug">
        {recipe.body.map((p, i) => (
          <p key={i}>{renderInline(p)}</p>
        ))}
      </div>
    </article>
  );
}

export function AdvertBox({ advert }: { advert: EditionImage }) {
  return (
    <article className="border border-ink p-4 flex flex-col break-inside-avoid">
      <p className="text-center text-[11px] uppercase tracking-[0.25em]">Advertisement</p>
      <Rule />
      <img
        src={advert.src}
        alt={advert.alt}
        loading="lazy"
        className="w-full grayscale contrast-110"
      />
      {advert.caption && (
        <>
          <Rule />
          <p className="text-center text-[12px] italic">{advert.caption}</p>
        </>
      )}
    </article>
  );
}
