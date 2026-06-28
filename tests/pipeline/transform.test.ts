import { test, expect } from "bun:test";
import { transformStory } from "@/pipeline/transform";
import type { SourceStory, Slot } from "@/pipeline/types";

const story: SourceStory = {
  source: "fox",
  headline: "Cabinet talks resume",
  summary: "Ministers reassembled to consider the terms.",
  image: { src: "/img/main-photo.jpg", alt: "Ministers", caption: "No. 10." },
};

test("maps headline/summary into an Article with slot size and columns", () => {
  const slot: Slot = { position: 1, source: "fox", size: "xl", columns: 2, hasImage: true };
  const a = transformStory(story, slot);
  expect(a.title).toBe("Cabinet talks resume");
  expect(a.body).toEqual(["Ministers reassembled to consider the terms."]);
  expect(a.size).toBe("xl");
  expect(a.columns).toBe(2);
  expect(a.byline).toBeTruthy();
  expect(a.image).toEqual(story.image);
});

test("omits the image when the slot carries none", () => {
  const slot: Slot = { position: 3, source: "fox", size: "md", columns: 2, hasImage: false };
  const a = transformStory(story, slot);
  expect(a.image).toBeUndefined();
  expect(a.size).toBe("md");
});
