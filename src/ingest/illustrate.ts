// src/ingest/illustrate.ts
// Redraw an article photo as a strictly black-and-white 1960s courtroom sketch
// via Gemini's image model. Only the top-ranked article per source is
// illustrated (those are the two slots that show a photo); on failure the
// image is skipped (the slot renders text-only).
import { GoogleGenAI } from "@google/genai";
import type { Source } from "@/pipeline/types";
import type { GarlicArticle } from "@/ingest/types";
import type { UsageTracker } from "@/ingest/usage";

export const IMAGE_MODEL = process.env.GEMINI_MODEL_IMAGE ?? "gemini-3.1-flash-image-preview";

export const ILLUSTRATE_PROMPT = `Redraw this photograph as a 1960s newspaper COURTROOM SKETCH:
- loose hand-drawn pen-and-ink linework with cross-hatching for shading;
- STRICTLY BLACK AND WHITE — no colour at all, monochrome only;
- plain warm off-white background of colour #F3F2EE (matching newsprint), no border;
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

// Illustrate the top `perSource` article(s) per source that carry a photo.
// Up to `retries` extra attempts on failure; if all fail, leave the article
// without an illustration (its slot will render text-only). Other articles are
// returned unchanged (no illustration).
export async function illustrateSelected(
  articles: GarlicArticle[],
  opts: {
    generate: ImageGenerator;
    fetchBytes?: FetchBytes;
    perSource?: number;
    retries?: number;
    warn?: (msg: string) => void;
  },
): Promise<GarlicArticle[]> {
  const fetchBytes = opts.fetchBytes ?? realFetchBytes;
  const perSource = opts.perSource ?? 1;
  const retries = opts.retries ?? 1;
  const warn = opts.warn ?? ((msg: string) => console.warn(msg));

  const chosen = new Set<GarlicArticle>();
  for (const source of SOURCES) {
    articles
      .filter((a) => a.source === source && a.imageUrl)
      .slice(0, perSource)
      .forEach((a) => chosen.add(a));
  }

  const result: GarlicArticle[] = [];
  for (const a of articles) {
    if (!chosen.has(a) || !a.imageUrl) {
      result.push(a);
      continue;
    }
    let original: Uint8Array | null = null;
    try {
      original = await fetchBytes(a.imageUrl);
    } catch (err) {
      warn(`illustrate: could not fetch photo for "${a.garlicTitle}": ${errMsg(err)}`);
    }
    let bytes: Uint8Array | null = null;
    let lastErr: unknown;
    for (let attempt = 0; original && attempt <= retries && !bytes; attempt++) {
      try {
        bytes = await opts.generate({ imageBytes: original, mimeType: "image/jpeg" });
      } catch (err) {
        lastErr = err;
        bytes = null;
      }
    }
    if (original && !bytes) {
      const reason = lastErr ? errMsg(lastErr) : "model returned no image";
      warn(
        `illustrate: could not illustrate "${a.garlicTitle}" after ${retries + 1} attempt(s) (${reason}); slot will be text-only.`,
      );
    }
    // On success keep BOTH the sketch and the source photo (audit trail).
    result.push(bytes ? { ...a, illustration: bytes, originalImage: original ?? undefined } : a);
  }
  return result;
}
