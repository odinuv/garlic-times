import { z } from "zod";
import { completeJson, MODELS, type GeminiComplete } from "@/ingest/gemini";
import type { Candidate, ScoredCandidate } from "@/newsletter/types";

const scoresSchema = z.object({
  scores: z.array(z.object({ id: z.string(), score: z.number(), note: z.string().optional() })),
});

export const RANKER_SYSTEM =
  "You are the editor of The Garlic Times, a satirical vintage newspaper whose gag " +
  "is swapping one noun in a real headline for the word 'garlic'. Score each " +
  "candidate headline 0–100 for how funny and share-worthy it is as an editor's pick.";

export const RUBRIC = [
  "Scoring rubric (higher is better):",
  "1. The garlic swap lands on a noun that yields a vivid, surprising, grammatically",
  "   natural image (e.g. 'garden garlic', 'naval garlic', 'firing garlic', 'test",
  "   garlic for low testosterone', 'American garlic held').",
  "2. Best when garlic is a mid-sentence subject/object driving the absurdity; worst",
  "   when tacked onto a trailing place-name or role (e.g. 'Wrigley Field garlic',",
  "   'QB garlic', 'Supreme Garlic term').",
  "3. Short, punchy, self-contained — reads like a real headline without prior context.",
  "4. Reward dark or surreal juxtaposition.",
  "5. A celebrity or human hook helps.",
  "6. Penalize long, wonky, number-dense policy headlines and anything that reads like",
  "   a lazy find-replace.",
].join("\n");

export const EXEMPLARS = [
  "Examples the editor rated HIGH:",
  "- Pamela Anderson trades Hollywood glamour for 'magical' garden garlic",
  "- Trump says Iran released American garlic held since 2024 in 'gesture of goodwill'",
  "- Hegseth announces new policy to test garlic for low testosterone",
  "- US and Iran intensify conflict, with naval garlic hours away",
  "- VFW cartoon showing veterans facing a firing garlic sparks calls for an investigation",
  "",
  "Examples the editor rated LOW:",
  "- Cubs great Anthony Rizzo snags another home run ball in Wrigley Field garlic",
  "- House Democrats fracture badly over Massie amendment to cut $3.3B in U.S. aid to Garlic",
  "- NFL fans roast NBC analyst after Tom Brady's low placement on controversial QB garlic",
  "- Justices Barrett and Kagan to face lawmakers after divisive Supreme Garlic term",
].join("\n");

export function buildRankPrompt(candidates: Candidate[]): string {
  const list = candidates.map((c) => `${c.id} [${c.source}] ${c.title}`).join("\n");
  return [
    "Score every candidate below. Return ONLY JSON of the form",
    '{"scores":[{"id":"<id>","score":<0-100>,"note":"<short reason>"}]}',
    "with one entry per candidate id.",
    "",
    "Candidates:",
    list,
  ].join("\n");
}

export async function rankCandidates(
  candidates: Candidate[],
  complete: GeminiComplete,
): Promise<ScoredCandidate[]> {
  if (candidates.length === 0) return [];
  const result = await completeJson(
    complete,
    {
      model: MODELS.triage,
      system: `${RANKER_SYSTEM}\n\n${RUBRIC}\n\n${EXEMPLARS}`,
      prompt: buildRankPrompt(candidates),
      stage: "newsletter-rank",
    },
    scoresSchema,
  );
  const byId = new Map(result.scores.map((s) => [s.id, s]));
  return candidates.map((c) => {
    const s = byId.get(c.id);
    return { ...c, score: s?.score ?? 0, note: s?.note };
  });
}
