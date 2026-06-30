import { test, expect } from "bun:test";
import { z } from "zod";
import { completeJson, MODELS, type GeminiComplete } from "@/ingest/gemini";

const schema = z.object({ value: z.number() });

test("completeJson parses valid JSON from the model", async () => {
  const fake: GeminiComplete = async () => JSON.stringify({ value: 42 });
  const out = await completeJson(fake, { model: "m", system: "s", prompt: "p" }, schema);
  expect(out).toEqual({ value: 42 });
});

test("completeJson retries once when the first response is invalid", async () => {
  let calls = 0;
  const fake: GeminiComplete = async () => {
    calls += 1;
    return calls === 1 ? "not json" : JSON.stringify({ value: 7 });
  };
  const out = await completeJson(fake, { model: "m", system: "s", prompt: "p" }, schema, 1);
  expect(out).toEqual({ value: 7 });
  expect(calls).toBe(2);
});

test("completeJson throws after exhausting retries", async () => {
  const fake: GeminiComplete = async () => "still not json";
  await expect(
    completeJson(fake, { model: "m", system: "s", prompt: "p" }, schema, 1),
  ).rejects.toThrow();
});

test("MODELS exposes triage and body defaults", () => {
  expect(typeof MODELS.triage).toBe("string");
  expect(typeof MODELS.body).toBe("string");
});
