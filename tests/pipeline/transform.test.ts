import { test, expect } from "bun:test";
import { transformStory } from "@/pipeline/transform";
import type { SourceStory, Slot } from "@/pipeline/types";

const story: SourceStory = {
  source: "fox",
  headline: "Cabinet talks resume",
  body: ["Para one.", "Para two.", "Para three.", "Para four."],
  image: { src: "/img/main-photo.jpg", alt: "Ministers", caption: "No. 10." },
};

test("xl slot keeps up to 4 paragraphs and the image", () => {
  const slot: Slot = { position: 1, source: "fox", size: "xl", columns: 2, hasImage: true };
  const a = transformStory(story, slot);
  expect(a.title).toBe("Cabinet talks resume");
  expect(a.body).toEqual(["Para one.", "Para two.", "Para three.", "Para four."]);
  expect(a.size).toBe("xl");
  expect(a.byline).toBeTruthy();
  expect(a.image).toEqual(story.image);
});

test("lg slot keeps the first 3 paragraphs", () => {
  const slot: Slot = { position: 2, source: "fox", size: "lg", columns: 2, hasImage: true };
  expect(transformStory(story, slot).body).toEqual(["Para one.", "Para two.", "Para three."]);
});

test("md slot keeps the first 2 paragraphs and omits the image when the slot has none", () => {
  const slot: Slot = { position: 3, source: "fox", size: "md", columns: 2, hasImage: false };
  const a = transformStory(story, slot);
  expect(a.body).toEqual(["Para one.", "Para two."]);
  expect(a.image).toBeUndefined();
});
