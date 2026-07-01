import { z } from "zod";
import type { GarlicTitled, GarlicArticle } from "@/ingest/types";
import { completeJson, MODELS, type GeminiComplete } from "@/ingest/gemini";

const SYSTEM = `You lightly edit a news article for "The Garlic Times".
Keep the wording AS CLOSE TO THE ORIGINAL AS POSSIBLE — this is NOT a rewrite.
Replace every reference to the given term (and its grammatical variants) with "garlic"/"Garlic".
If isMaga is true, treat "MAGA" as "Make America Garlic Again".
Shorten the result to AT MOST 4 short paragraphs totalling roughly 1200-1600 characters.
Reply as JSON {"paragraphs": ["para1", "para2", ...]} — plain text paragraphs, no markdown.`;

const schema = z.object({ paragraphs: z.array(z.string().min(1)).min(1) });

export async function swapBody(
  candidate: GarlicTitled,
  complete: GeminiComplete,
): Promise<GarlicArticle> {
  const prompt = `Term to replace with garlic: "${candidate.swappedTerm || "(none — MAGA story)"}"
isMaga: ${candidate.isMaga}
Garlic headline: ${candidate.garlicTitle}

Original article:
${candidate.bodyMarkdown}`;
  const { paragraphs } = await completeJson(
    complete,
    { model: MODELS.body, system: SYSTEM, prompt },
    schema,
  );
  return { ...candidate, body: paragraphs.slice(0, 4) };
}
