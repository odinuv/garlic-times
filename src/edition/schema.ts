// src/edition/schema.ts
import { z } from "zod";

export const imageSchema = z.object({
  src: z.string().min(1),
  alt: z.string(),
  caption: z.string().optional(),
  // Intrinsic pixel dimensions, filled in at build time from the file on disk.
  // Emitting width/height lets the browser reserve the image's box before it
  // loads, so lazy photos no longer shove the column downward (zero CLS).
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const articleSchema = z.object({
  title: z.string().min(1),
  byline: z.string().optional(),
  body: z.array(z.string()).min(1),
  size: z.enum(["sm", "md", "lg", "xl"]).default("md"),
  columns: z.union([z.literal(1), z.literal(2)]).default(2),
  image: imageSchema.optional(),
  sourceUrl: z.string().optional(),
  // 1-based article index within the edition; matches the #article-{n} anchor
  // and per-article page. Optional/additive so older archived editions parse.
  number: z.number().int().positive().optional(),
  // Which source this article came from. The newsletter reads it directly;
  // optional/additive for backward compatibility.
  source: z.enum(["cnn", "fox"]).optional(),
});

export const editionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD"),
  displayDate: z.string().min(1),
  editionNo: z.string(),
  strapline: z.string().min(1),
  price: z.string(),
  masthead: z.object({
    the: z.string(),
    middle: z.string(),
    end: z.string(),
    glyph: z.string().min(1),
  }),
  articles: z.array(articleSchema).min(1),
  rates: z.object({
    title: z.string(),
    lead: z.object({
      label: z.string(),
      usd: z.string(),
      eur: z.string(),
      delta: z.string(),
    }),
    rows: z.array(z.object({ label: z.string(), value: z.string(), delta: z.string() })),
  }),
  recipe: z.object({
    kicker: z.string(),
    title: z.string(),
    meta: z.string(),
    body: z.array(z.string()).min(1),
  }),
  advert: imageSchema,
  meta: z.object({ title: z.string(), description: z.string() }),
});

export type EditionImage = z.infer<typeof imageSchema>;
export type Article = z.infer<typeof articleSchema>;
export type Edition = z.infer<typeof editionSchema>;

export function parseEdition(raw: unknown, file: string): Edition {
  const result = editionSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid edition "${file}":\n${issues}`);
  }
  return result.data;
}
