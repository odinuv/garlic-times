// src/ingest/illustrate.ts
// Redraw an article photo as a strictly black-and-white 1960s courtroom sketch
// via Gemini's image model. Per source, candidates are tried in rank order and
// the first one that can be drawn wins its source's image slot (so the cnn/fox
// ratio is preserved); a content refusal moves on to the next candidate, only
// transient errors are retried, and if none can be drawn the slot is text-only.
import { GoogleGenAI } from "@google/genai";
import type { Source } from "@/pipeline/types";
import type { GarlicArticle } from "@/ingest/types";
import { isTransientError } from "@/ingest/gemini";
import type { UsageTracker } from "@/ingest/usage";

export const IMAGE_MODEL = process.env.GEMINI_MODEL_IMAGE ?? "gemini-3.1-flash-image-preview";

export const ILLUSTRATE_PROMPT = `Redraw this photograph as a 1960s newspaper COURTROOM SKETCH:
- loose hand-drawn pen-and-ink linework with cross-hatching for shading;
- STRICTLY BLACK AND WHITE — no colour at all, monochrome only;
- a plain PURE WHITE (#FFFFFF) background — no border, no shadow, no vignette, no grey fill;
- keep the main subject clearly recognisable.
Output only the illustration.`;

export type ImageGenerator = (args: {
  imageBytes: Uint8Array;
  mimeType: string;
}) => Promise<Uint8Array | null>;

export type FetchBytes = (url: string) => Promise<Uint8Array>;

export function createImageGenerator(
  apiKey = process.env.GEMINI_API_KEY,
  tracker?: UsageTracker,
): ImageGenerator {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set (add it to .env). See .env.example.");
  }
  const ai = new GoogleGenAI({ apiKey });
  return async ({ imageBytes, mimeType }) => {
    const res = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [
        {
          parts: [
            { text: ILLUSTRATE_PROMPT },
            { inlineData: { mimeType, data: Buffer.from(imageBytes).toString("base64") } },
          ],
        },
      ],
    });
    const u = res.usageMetadata;
    if (tracker && u) {
      tracker.record(
        "illustrate",
        IMAGE_MODEL,
        u.promptTokenCount ?? 0,
        u.candidatesTokenCount ?? 0,
      );
    }
    const cand = res.candidates?.[0];
    for (const p of cand?.content?.parts ?? []) {
      if (p.inlineData?.data) return new Uint8Array(Buffer.from(p.inlineData.data, "base64"));
    }
    // No image part — usually a content-safety refusal. Surface the reason
    // (finishReason / any text the model returned) so the skip log explains why.
    const textPart = cand?.content?.parts?.find((p) => p.text)?.text;
    throw new Error(
      `no image returned (finishReason=${cand?.finishReason ?? "unknown"}${textPart ? `: ${textPart.slice(0, 160)}` : ""})`,
    );
  };
}

const realFetchBytes: FetchBytes = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": "garlic-times-ingest/1.0" } });
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}) for ${url}`);
  return new Uint8Array(await res.arrayBuffer());
};

const SOURCES: Source[] = ["cnn", "fox"];

const errMsg = (err: unknown): string => (err instanceof Error ? err.message : String(err));

// Per source, illustrate candidate photos in rank order and stop at the first
// success — so each source's image slot gets a photo that could actually be
// drawn, without losing the source. Content refusals move straight to the next
// candidate; only transient errors (503/429/...) are retried. If every candidate
// fails, that source has no illustration and its image slot renders text-only.
export async function illustrateSelected(
  articles: GarlicArticle[],
  opts: {
    generate: ImageGenerator;
    fetchBytes?: FetchBytes;
    transientRetries?: number;
    isTransient?: (err: unknown) => boolean;
    warn?: (msg: string) => void;
  },
): Promise<GarlicArticle[]> {
  const fetchBytes = opts.fetchBytes ?? realFetchBytes;
  const transientRetries = opts.transientRetries ?? 1;
  const isTransient = opts.isTransient ?? isTransientError;
  const warn = opts.warn ?? ((msg: string) => console.warn(msg));

  const made = new Map<GarlicArticle, { sketch: Uint8Array; original: Uint8Array }>();

  for (const source of SOURCES) {
    const candidates = articles.filter((a) => a.source === source && a.imageUrl);
    let success = false;
    for (const a of candidates) {
      let original: Uint8Array;
      try {
        original = await fetchBytes(a.imageUrl!);
      } catch (err) {
        warn(`illustrate: could not fetch photo for "${a.garlicTitle}": ${errMsg(err)}`);
        continue;
      }
      let bytes: Uint8Array | null = null;
      let lastErr: unknown;
      for (let attempt = 0; attempt <= transientRetries && !bytes; attempt++) {
        try {
          bytes = await opts.generate({ imageBytes: original, mimeType: "image/jpeg" });
          if (!bytes) break; // returned no image — treat as permanent, try next article
        } catch (err) {
          lastErr = err;
          if (!isTransient(err)) break; // content refusal / permanent — try next article
        }
      }
      if (bytes) {
        // On success keep BOTH the sketch and the source photo (audit trail).
        made.set(a, { sketch: bytes, original });
        success = true;
        break;
      }
      const reason = lastErr !== undefined ? errMsg(lastErr) : "model returned no image";
      warn(
        `illustrate: could not illustrate "${a.garlicTitle}" (${reason}); trying the next ${source} article.`,
      );
    }
    if (!success) {
      warn(
        `illustrate: no ${source} photo could be illustrated; that image slot will be text-only.`,
      );
    }
  }

  return articles.map((a) => {
    const m = made.get(a);
    return m ? { ...a, illustration: m.sketch, originalImage: m.original } : a;
  });
}
