// src/ingest/pipeline.ts
import type { Source } from "@/pipeline/types";
import type { GarlicArticle } from "@/ingest/types";
import { fetchCandidates, type FetchFn } from "@/ingest/fetch";
import { classifyCandidates } from "@/ingest/classify";
import { garlicTitleCandidates } from "@/ingest/garlicTitle";
import { selectBest } from "@/ingest/select";
import { swapBody } from "@/ingest/bodySwap";
import { writeSourceFiles } from "@/ingest/writeSources";
import type { GeminiComplete } from "@/ingest/gemini";
import type { SelectionEntry } from "@/ingest/usage";

const SOURCES: Source[] = ["cnn", "fox"];

export async function runIngest(opts: {
  contentDir: string;
  complete: GeminiComplete;
  fetchText?: FetchFn;
  fetchBytes?: (url: string) => Promise<Uint8Array>;
  perSource?: number;
  minPerSource?: number;
}): Promise<{ written: number; selection: SelectionEntry[] }> {
  const { contentDir, complete } = opts;
  const perSource = opts.perSource ?? 4;
  const minPerSource = opts.minPerSource ?? 3;

  const candidates = (
    await Promise.all(SOURCES.map((s) => fetchCandidates(s, { fetchText: opts.fetchText })))
  ).flat();

  const eligible = await classifyCandidates(candidates, complete);
  const titled = await garlicTitleCandidates(eligible, complete);
  const selected = await selectBest(titled, complete, perSource);

  const articles: GarlicArticle[] = [];
  for (const c of selected) articles.push(await swapBody(c, complete));

  for (const source of SOURCES) {
    const n = articles.filter((a) => a.source === source).length;
    if (n < minPerSource) {
      throw new Error(
        `Only ${n} "${source}" articles after selection; need at least ${minPerSource}.`,
      );
    }
  }

  const pickedUrls = new Set(selected.map((c) => c.url));
  const selection: SelectionEntry[] = titled.map((t) => ({
    source: t.source,
    garlicTitle: t.garlicTitle,
    picked: pickedUrls.has(t.url),
  }));

  await writeSourceFiles({ articles, contentDir, fetchBytes: opts.fetchBytes });
  return { written: articles.length, selection };
}
