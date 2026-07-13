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

/** True for server-side / network errors worth retrying (not client mistakes). */
export function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /\b(429|500|503)\b/.test(msg) ||
    /(UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|overloaded|unavailable|deadline exceeded|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN)/i.test(
      msg,
    ) ||
    /fetch failed|network|socket hang up/i.test(msg)
  );
}

/**
 * Run `fn`, retrying transient failures with exponential backoff. Non-transient
 * errors throw immediately. `sleep` is injectable so tests don't actually wait.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: {
    retries?: number;
    baseDelayMs?: number;
    isTransient?: (err: unknown) => boolean;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const transient = opts.isTransient ?? isTransientError;
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !transient(err)) throw err;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastErr;
}

export function createGeminiComplete(
  apiKey = process.env.GEMINI_API_KEY,
  tracker?: UsageTracker,
): GeminiComplete {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set (add it to .env). See .env.example.");
  }
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, system, prompt, stage }) => {
    // Retry transient server/network errors (e.g. 503 "high demand") with backoff.
    const res = await withRetry(() =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          // These stages are mechanical JSON extraction — no chain-of-thought
          // needed. Gemini 2.5 "thinking" is on by default and its (highly
          // variable) thinking tokens share the output budget; when thinking +
          // JSON exceeds the cap the reply is truncated, causing intermittent
          // "Unexpected EOF" JSON parse failures. Disable thinking and give the
          // response ample room so the full budget goes to the JSON.
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: 8192,
        },
      }),
    );
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
