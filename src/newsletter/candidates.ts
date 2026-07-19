import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEdition, type Article } from "@/edition/schema";
import type { Source } from "@/pipeline/types";
import { assignSlots } from "@/pipeline/selection";
import { absoluteUrl } from "@/edition/site";
import { mondayToFriday } from "@/newsletter/week";
import type { Candidate } from "@/newsletter/types";

/** Resolve an article's source: explicit field -> sourceUrl domain -> slot parity. */
export function resolveSource(article: Article, index: number, date: string): Source {
  if (article.source) return article.source;
  const url = article.sourceUrl ?? "";
  if (/foxnews\.com/i.test(url)) return "fox";
  if (/cnn\.com/i.test(url)) return "cnn";
  const slots = assignSlots(date);
  return slots[index]?.source ?? "cnn";
}

/** Flatten the Mon–Fri editions of `saturdayDate`'s ISO week into candidates. */
export function loadWeekCandidates(contentDir: string, saturdayDate: string): Candidate[] {
  const srcDir = join(contentDir, "src");
  const out: Candidate[] = [];
  for (const { date, weekday } of mondayToFriday(saturdayDate)) {
    const file = join(srcDir, `${date}.json`);
    if (!existsSync(file)) continue; // a weekday with no edition is simply skipped
    const edition = parseEdition(JSON.parse(readFileSync(file, "utf8")), `${date}.json`);
    edition.articles.forEach((article, i) => {
      const number = article.number ?? i + 1;
      out.push({
        id: `${date}#${number}`,
        date,
        weekday,
        number,
        source: resolveSource(article, i, date),
        title: article.title,
        dek: article.body[0],
        // Per-article permalink (/<date>/<n>/), i.e. the article's own page —
        // the "like page" the newsletter links readers to. It resolves to the
        // article (currently via a redirect to the edition anchor).
        url: absoluteUrl(`/${date}/${number}/`),
      });
    });
  }
  return out;
}
