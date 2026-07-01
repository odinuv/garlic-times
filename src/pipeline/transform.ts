import type { Article } from "@/edition/schema";
import type { Source, SourceStory, Slot } from "@/pipeline/types";

const BYLINE: Record<Source, string> = {
  fox: "From our Correspondent",
  cnn: "From our Special Correspondent",
};

const PARAS_FOR_SIZE: Record<Slot["size"], number> = { xl: 4, lg: 3, md: 2 };

export function transformStory(story: SourceStory, slot: Slot): Article {
  const paras = story.body.slice(0, PARAS_FOR_SIZE[slot.size]);
  return {
    title: story.headline,
    byline: BYLINE[story.source],
    size: slot.size,
    columns: slot.columns,
    body: paras.length > 0 ? paras : story.body.slice(0, 1),
    image: slot.hasImage ? story.image : undefined,
  };
}
