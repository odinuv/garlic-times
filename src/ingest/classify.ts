import { z } from "zod";
import type { Candidate } from "@/ingest/types";
import { completeJson, MODELS, type GeminiComplete } from "@/ingest/gemini";

const SYSTEM = `You decide whether a news story is ELIGIBLE for a light satirical newspaper.
INELIGIBLE if the story is primarily about:
- a natural disaster: fire, flood, earthquake, hurricane, tornado, typhoon, snow emergency;
- a shooting;
- a massacre or mass killing of people.
War/conflict IS eligible UNLESS the story is primarily about mass killing of people.
Everything else (politics, economy, courts, diplomacy, culture, sport) is ELIGIBLE.`;

const schema = z.array(
  z.object({ index: z.number().int(), eligible: z.boolean(), reason: z.string() }),
);

export async function classifyCandidates(
  candidates: Candidate[],
  complete: GeminiComplete,
): Promise<Candidate[]> {
  if (candidates.length === 0) return [];
  const list = candidates
    .map((c, i) => `${i}. ${c.title}\n   ${c.bodyMarkdown.slice(0, 300).replace(/\s+/g, " ")}`)
    .join("\n");
  const prompt = `Classify each story. Reply with a JSON array of {index, eligible, reason}, one per story.\n\n${list}`;
  const verdicts = await completeJson(complete, { model: MODELS.triage, system: SYSTEM, prompt }, schema);
  const eligible = new Set(verdicts.filter((v) => v.eligible).map((v) => v.index));
  return candidates.filter((_, i) => eligible.has(i));
}
