import { z } from "zod";
import type { GarlicTitled } from "@/ingest/types";
import type { Source } from "@/pipeline/types";
import { completeJson, MODELS, type GeminiComplete } from "@/ingest/gemini";

const SYSTEM = `You curate the front page of a satirical paper. Pick the funniest, most front-page-worthy
garlic headlines. Choose the best from each source separately.`;

const schema = z.object({ cnn: z.array(z.number().int()), fox: z.array(z.number().int()) });

export async function selectBest(
  candidates: GarlicTitled[],
  complete: GeminiComplete,
  perSource = 4,
): Promise<GarlicTitled[]> {
  if (candidates.length === 0) return [];
  const list = candidates.map((c, i) => `${i}. [${c.source}] ${c.garlicTitle}`).join("\n");
  const prompt = `From the list below, pick the best up to ${perSource} from "cnn" and up to ${perSource} from "fox".
Reply as JSON {"cnn":[indices...],"fox":[indices...]} ordered best-first.\n\n${list}`;
  const picked = await completeJson(
    complete,
    { model: MODELS.triage, system: SYSTEM, prompt, stage: "select" },
    schema,
  );

  const take = (source: Source, indices: number[]): GarlicTitled[] =>
    indices
      .map((i) => candidates[i])
      .filter((c): c is GarlicTitled => !!c && c.source === source)
      .slice(0, perSource);

  return [...take("cnn", picked.cnn), ...take("fox", picked.fox)];
}
