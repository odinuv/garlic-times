import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import type { UsageTracker } from "@/ingest/usage";

export type GeminiComplete = (args: {
  model: string;
  system: string;
  prompt: string;
  stage?: string;
}) => Promise<string>;

export const MODELS = {
  triage: process.env.GEMINI_MODEL_TRIAGE ?? "gemini-2.5-flash",
  body: process.env.GEMINI_MODEL_BODY ?? "gemini-2.5-flash-lite",
};

export function createGeminiComplete(
  apiKey = process.env.GEMINI_API_KEY,
  tracker?: UsageTracker,
): GeminiComplete {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set (add it to .env). See .env.example.");
  }
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, system, prompt, stage }) => {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction: system, responseMimeType: "application/json" },
    });
    const u = res.usageMetadata;
    if (tracker && u) {
      tracker.record(
        stage ?? "unknown",
        model,
        u.promptTokenCount ?? 0,
        u.candidatesTokenCount ?? 0,
      );
    }
    return res.text ?? "";
  };
}

export async function completeJson<T>(
  complete: GeminiComplete,
  args: { model: string; system: string; prompt: string; stage?: string },
  schema: ZodType<T>,
  retries = 1,
): Promise<T> {
  let lastErr: unknown;
  let prompt = args.prompt;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const text = await complete({ ...args, prompt });
    try {
      return schema.parse(JSON.parse(text));
    } catch (err) {
      lastErr = err;
      prompt = `${args.prompt}\n\nYour previous reply was not valid JSON matching the required shape. Reply with ONLY valid JSON, no prose, no markdown fences.`;
    }
  }
  throw new Error(
    `Gemini returned invalid JSON after ${retries + 1} attempts: ${lastErr instanceof Error ? lastErr.message : lastErr}`,
  );
}
