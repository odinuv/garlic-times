import { z } from "zod";
import type { GarlicTitled, GarlicArticle } from "@/ingest/types";
import { completeJson, MODELS, type GeminiComplete } from "@/ingest/gemini";

const SYSTEM = `You lightly edit a news article for "The Garlic Times".
Keep the wording AS CLOSE TO THE ORIGINAL AS POSSIBLE — this is NOT a rewrite.
Replace EVERY mention of the given term with "garlic"/"Garlic" — leave none behind. This includes:
  - the exact word, its singular AND plural, and BOTH its capitalised and lowercase forms;
  - closely related word-forms and derivatives (e.g. if the term is "taxes", also replace "tax", "Tax", "taxpayer(s)", "Tax filers");
  - later pronouns or references that clearly stand in for it.
Match the case of what you replace: at a sentence start or where the original was capitalised use "Garlic", otherwise "garlic". Scan the whole text and do not miss any occurrence.
If isMaga is true, treat "MAGA" as "Make America Garlic Again".
LENGTH IS A HARD LIMIT, not a suggestion. Cut the article down to AT MOST 4 short paragraphs whose combined length is 1000-1400 characters (about 170-230 words) TOTAL — never exceed 1500. Each paragraph is 2-3 sentences (~250-350 characters). Keep the lead and the key facts; aggressively drop trailing detail, quotes, and secondary points to hit the limit. Do not pad.
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
    { model: MODELS.body, system: SYSTEM, prompt, stage: "body-swap" },
    schema,
  );
  return { ...candidate, body: paragraphs.slice(0, 4) };
}
