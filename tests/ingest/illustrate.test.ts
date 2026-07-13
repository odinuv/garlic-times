import { test, expect } from "bun:test";
import { illustrateSelected, type ImageGenerator, type FetchBytes } from "@/ingest/illustrate";
import type { GarlicArticle } from "@/ingest/types";
import type { Source } from "@/pipeline/types";

const art = (source: Source, n: number, hasImage: boolean): GarlicArticle => ({
  source,
  url: `https://${source}/${n}`,
  title: `t${n}`,
  bodyMarkdown: "b",
  garlicTitle: `${source} garlic ${n}`,
  swappedTerm: "x",
  isMaga: false,
  body: ["p"],
  ...(hasImage ? { imageUrl: `https://img/${source}-${n}.jpg` } : {}),
});

const fetchBytes: FetchBytes = async () => new Uint8Array([1, 2, 3]);
const okGen: ImageGenerator = async () => new Uint8Array([9, 9]);

test("illustrates the first candidate per source and keeps the source photo", async () => {
  const articles = [
    art("cnn", 1, true),
    art("cnn", 2, true),
    art("fox", 1, true),
    art("fox", 2, false),
  ];
  const out = await illustrateSelected(articles, { generate: okGen, fetchBytes });
  expect(out[0].illustration).toBeInstanceOf(Uint8Array); // cnn1 = first success
  expect(out[0].originalImage).toEqual(new Uint8Array([1, 2, 3])); // audit trail
  expect(out[1].illustration).toBeUndefined(); // cnn2 not attempted (cnn1 won)
  expect(out[2].illustration).toBeInstanceOf(Uint8Array); // fox1
  expect(out[3].illustration).toBeUndefined(); // fox2 has no photo
});

test("falls through to the next candidate when a photo is refused (no wasted retry)", async () => {
  let calls = 0;
  const gen: ImageGenerator = async () => {
    calls += 1;
    if (calls === 1) throw new Error("no image returned (finishReason=IMAGE_SAFETY)");
    return new Uint8Array([9]);
  };
  const out = await illustrateSelected([art("cnn", 1, true), art("cnn", 2, true)], {
    generate: gen,
    fetchBytes,
    warn: () => {},
  });
  expect(out[0].illustration).toBeUndefined(); // cnn1 refused
  expect(out[1].illustration).toBeInstanceOf(Uint8Array); // cnn2 drawn instead
  expect(calls).toBe(2); // cnn1 once (permanent → no retry) + cnn2 once
});

test("retries a transient error on the same candidate", async () => {
  let calls = 0;
  const gen: ImageGenerator = async () => {
    calls += 1;
    if (calls === 1) throw new Error("503 UNAVAILABLE");
    return new Uint8Array([7]);
  };
  const out = await illustrateSelected([art("cnn", 1, true), art("cnn", 2, true)], {
    generate: gen,
    fetchBytes,
    transientRetries: 1,
    warn: () => {},
  });
  expect(out[0].illustration).toEqual(new Uint8Array([7])); // cnn1 succeeded on retry
  expect(out[1].illustration).toBeUndefined(); // cnn2 not needed
  expect(calls).toBe(2);
});

test("leaves a source imageless and logs when every candidate is refused", async () => {
  const gen: ImageGenerator = async () => {
    throw new Error("no image returned (finishReason=IMAGE_SAFETY)");
  };
  const warnings: string[] = [];
  const out = await illustrateSelected([art("cnn", 1, true), art("cnn", 2, true)], {
    generate: gen,
    fetchBytes,
    warn: (m) => warnings.push(m),
  });
  expect(out.every((a) => a.illustration === undefined)).toBe(true);
  expect(warnings.some((w) => w.includes("no cnn photo"))).toBe(true);
});
