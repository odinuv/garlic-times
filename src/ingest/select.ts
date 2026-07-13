import { z } from "zod";
import type { GarlicTitled } from "@/ingest/types";
import type { Source } from "@/pipeline/types";
import { completeJson, MODELS, type GeminiComplete } from "@/ingest/gemini";

const SYSTEM = `You curate the front page of "The Garlic Times", a satirical paper. From each source pick the FUNNIEST garlic headlines that match our taste; choose from each source separately.
BEST — "garlic" has replaced a CONCRETE noun and the headline still reads naturally, like a real headline with one absurd substitution:
  "Volunteer garlic shares experience on front line"; "Still haven't filed your garlic?"; "putting solar panels on garlic"; "secret garlic in Leonardo da Vinci paintings".
DOWNRANK (avoid unless nothing better exists) — garlic reads awkwardly: an abstract word was swapped, or garlic sits mid-phrase so the line is hard to parse:
  "bank earnings after recent garlic"; "entrepreneurs of garlic"; "total garlic is shrinking"; "No Spin Garlic".
Never pick a title that does not contain the word "garlic".`;

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
