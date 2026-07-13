import { z } from "zod";
import type { Candidate, GarlicTitled } from "@/ingest/types";
import { completeJson, MODELS, type GeminiComplete } from "@/ingest/gemini";

const SYSTEM = `You rewrite a news headline into a joke headline for "The Garlic Times".
You MUST replace exactly ONE word with "garlic" (match case: "Garlic" if it starts the title). NEVER return the headline unchanged.
Pick the word so the result is funny and STILL READS LIKE A REAL HEADLINE:
- Replace a CONCRETE, imageable COMMON noun — a physical thing or object (balloon, soldier, roofs, cocaine, taxes, painting). Swapping these for garlic is absurd yet the sentence still scans.
- Prefer the grammatical OBJECT; if there is no clear object, use the subject or another concrete common noun.
- Do NOT swap an abstract word (turmoil, capacity, appeal, visit, spending), and do NOT drop garlic into the middle of a phrase where it reads broken.
- NEVER replace a word that is part of a PROPER NAME — a person's first or last name, or a component of a place/company/organisation name. Mangling a real name reads as a typo, not a joke; leave proper names intact and swap a common noun elsewhere in the headline.
Keep the rest of the headline identical. Report "swappedTerm" = the original word you replaced.
SPECIAL CASE — narrow: ONLY when the headline TEXT literally contains the word "MAGA" do you set isMaga=true, leave the title UNCHANGED, and set swappedTerm to "" (readers know MAGA = "Make America Garlic Again"). EVERY other story — including other Trump, legal, or political stories — MUST get a word swapped for garlic; never set isMaga for those.
GOOD (concrete noun, still scans): "Chinese spy garlic was able to transmit information back to Beijing"; "Border agents uncover $3.7M in garlic masquerading as a cucumber delivery"; "Scientists identify secret garlic in Leonardo da Vinci paintings".
BAD (abstract or mid-phrase — avoid): "bank earnings after recent garlic"; "entrepreneurs of garlic"; "total garlic is shrinking".
BAD (mangled proper name — never do this): "a 'wellness island' is being built in Abu Garlic" (from "Abu Dhabi"); "Trump's journey with Lindsey Garlic" (from "Lindsey Graham").`;

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
  const results = await completeJson(
    complete,
    { model: MODELS.triage, system: SYSTEM, prompt, stage: "garlic-title" },
    schema,
  );
  const byIndex = new Map(results.map((r) => [r.index, r]));
  return (
    candidates
      .map((c, i) => {
        const r = byIndex.get(i);
        return r
          ? { ...c, garlicTitle: r.garlicTitle, swappedTerm: r.swappedTerm, isMaga: r.isMaga }
          : null;
      })
      .filter((x): x is GarlicTitled => x !== null)
      // Drop failed swaps: a non-MAGA title that never got the word "garlic".
      // (MAGA titles are intentionally left unchanged and have no "garlic".)
      .filter((g) => g.isMaga || /garlic/i.test(g.garlicTitle))
  );
}
