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
import type { SelectionEntry, Timing } from "@/ingest/usage";
import { illustrateSelected, type ImageGenerator, type FetchBytes } from "@/ingest/illustrate";

const SOURCES: Source[] = ["cnn", "fox"];

export async function runIngest(opts: {
  contentDir: string;
  complete: GeminiComplete;
  fetchText?: FetchFn;
  generateImage: ImageGenerator;
  fetchImageBytes?: FetchBytes;
  perSource?: number;
  minPerSource?: number;
}): Promise<{ written: number; selection: SelectionEntry[]; timings: Timing[] }> {
  const { contentDir, complete } = opts;
  const perSource = opts.perSource ?? 4;
  const minPerSource = opts.minPerSource ?? 3;

  const timings: Timing[] = [];
  const timed = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    const result = await fn();
    timings.push({ name, ms: performance.now() - start });
    return result;
  };

  const candidates = (
    await timed("fetch", () =>
      Promise.all(SOURCES.map((s) => fetchCandidates(s, { fetchText: opts.fetchText }))),
    )
  ).flat();

  const eligible = await timed("classify", () => classifyCandidates(candidates, complete));
  const titled = await timed("garlic-title", () => garlicTitleCandidates(eligible, complete));
  const selected = await timed("select", () => selectBest(titled, complete, perSource));

  // Concurrent: one small LLM call per article; Promise.all preserves order.
  const articles = await timed("body-swap", () =>
    Promise.all(selected.map((c) => swapBody(c, complete))),
  );

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

  const illustrated = await timed("illustrate", () =>
    illustrateSelected(articles, {
      generate: opts.generateImage,
      fetchBytes: opts.fetchImageBytes,
    }),
  );

  await timed("write", async () => writeSourceFiles({ articles: illustrated, contentDir }));
  return { written: illustrated.length, selection, timings };
}
