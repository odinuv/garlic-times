// STUB: a placeholder mapping from a raw source story to an Article.
// The real 1962-Times-style transformation replaces this module later;
// keep the (story, slot) -> Article interface stable.
import type { Article } from "@/edition/schema";
import type { Source, SourceStory, Slot } from "@/pipeline/types";

const BYLINE: Record<Source, string> = {
  fox: "From our Correspondent",
  cnn: "From our Special Correspondent",
};

export function transformStory(story: SourceStory, slot: Slot): Article {
  return {
    title: story.headline,
    byline: BYLINE[story.source],
    size: slot.size,
    columns: slot.columns,
    body: [story.summary],
    image: slot.hasImage ? story.image : undefined,
  };
}
