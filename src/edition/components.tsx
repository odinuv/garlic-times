import React from "react";
import type { Article, Edition, EditionImage } from "@/edition/schema";
import { renderInline } from "@/edition/inline";

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

export function ArticleBlock({ article }: { article: Article }) {
  const colsClass =
    article.columns === 2 ? "sm:columns-2 sm:gap-5 [column-rule:1px_solid_var(--ink)]" : "";
  return (
    <article className="mb-2">
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
        {article.body.map((p, i) => (
          <p key={i}>
            {renderInline(p)}
            {article.sourceUrl && i === article.body.length - 1 && (
              <>
                {" "}
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold no-underline"
                  aria-label="Read the original article"
                >
                  {">>"}
                </a>
              </>
            )}
          </p>
        ))}
      </div>
    </article>
  );
}

export function RatesBox({ rates }: { rates: Edition["rates"] }) {
  return (
    <article className="border border-ink p-3 break-inside-avoid">
      <p className="mb-1 text-center text-[10px] uppercase tracking-[0.25em]">{rates.title}</p>
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
