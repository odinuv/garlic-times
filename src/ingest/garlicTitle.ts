import { z } from "zod";
import type { Candidate, GarlicTitled } from "@/ingest/types";
import { completeJson, MODELS, type GeminiComplete } from "@/ingest/gemini";

const SYSTEM = `You rewrite a news headline into a joke headline for "The Garlic Times".
Replace exactly ONE noun in the headline with "garlic" (match case: "Garlic" if it starts the title).
Prefer the grammatical OBJECT of the headline; if there is no clear object, swap the subject or another salient noun.
Keep the rest of the headline identical. Keep it within ~38-55 characters where possible.
Report "swappedTerm" = the original word you replaced.
SPECIAL CASE: if the story is about MAGA, set isMaga=true, leave the title UNCHANGED, and set swappedTerm to "".
(For MAGA, readers know MAGA = "Make America Garlic Again".)`;

const schema = z.array(
  z.object({
    index: z.number().int(),
    garlicTitle: z.string().min(1),
    swappedTerm: z.string(),
    isMaga: z.boolean(),
  }),
);

export async function garlicTitleCandidates(
  candidates: Candidate[],
  complete: GeminiComplete,
): Promise<GarlicTitled[]> {
  if (candidates.length === 0) return [];
  const list = candidates.map((c, i) => `${i}. ${c.title}`).join("\n");
  const prompt = `Rewrite each headline. Reply with a JSON array of {index, garlicTitle, swappedTerm, isMaga}.\n\n${list}`;
  const results = await completeJson(complete, { model: MODELS.triage, system: SYSTEM, prompt }, schema);
  const byIndex = new Map(results.map((r) => [r.index, r]));
  return candidates
    .map((c, i) => {
      const r = byIndex.get(i);
      return r ? { ...c, garlicTitle: r.garlicTitle, swappedTerm: r.swappedTerm, isMaga: r.isMaga } : null;
    })
    .filter((x): x is GarlicTitled => x !== null);
}
