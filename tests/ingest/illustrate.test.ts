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

test("illustrates only the top article per source that has a photo", async () => {
  const articles = [
    art("cnn", 1, true),
    art("cnn", 2, true),
    art("fox", 1, true),
    art("fox", 2, false),
  ];
  const out = await illustrateSelected(articles, { generate: okGen, fetchBytes, perSource: 1 });
  expect(out[0].illustration).toBeInstanceOf(Uint8Array); // cnn top
  expect(out[0].originalImage).toEqual(new Uint8Array([1, 2, 3])); // source photo kept
  expect(out[1].illustration).toBeUndefined(); // cnn #2 not illustrated
  expect(out[1].originalImage).toBeUndefined();
  expect(out[2].illustration).toBeInstanceOf(Uint8Array); // fox top
  expect(out[3].illustration).toBeUndefined(); // fox #2 has no photo
});

test("does not keep an original when illustration fails", async () => {
  const gen: ImageGenerator = async () => null;
  const out = await illustrateSelected([art("cnn", 1, true)], {
    generate: gen,
    fetchBytes,
    retries: 0,
    warn: () => {},
  });
  expect(out[0].illustration).toBeUndefined();
  expect(out[0].originalImage).toBeUndefined();
});

test("retries once then succeeds", async () => {
  let calls = 0;
  const gen: ImageGenerator = async () => {
    calls += 1;
    if (calls === 1) throw new Error("503 UNAVAILABLE");
    return new Uint8Array([7]);
  };
  const out = await illustrateSelected([art("cnn", 1, true)], {
    generate: gen,
    fetchBytes,
    retries: 1,
  });
  expect(calls).toBe(2);
  expect(out[0].illustration).toEqual(new Uint8Array([7]));
});

test("skips the image and logs why when generation keeps failing", async () => {
  const gen: ImageGenerator = async () => {
    throw new Error("boom");
  };
  const warnings: string[] = [];
  const out = await illustrateSelected([art("cnn", 1, true)], {
    generate: gen,
    fetchBytes,
    retries: 1,
    warn: (m) => warnings.push(m),
  });
  expect(out[0].illustration).toBeUndefined();
  expect(warnings.some((w) => w.includes("cnn garlic 1") && w.includes("boom"))).toBe(true);
});

test("skips when the model returns no image (null)", async () => {
  const gen: ImageGenerator = async () => null;
  const out = await illustrateSelected([art("cnn", 1, true)], {
    generate: gen,
    fetchBytes,
    retries: 1,
    warn: () => {},
  });
  expect(out[0].illustration).toBeUndefined();
});
