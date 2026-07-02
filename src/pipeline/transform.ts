import type { Article } from "@/edition/schema";
import type { SourceStory, Slot } from "@/pipeline/types";

// Period-style bylines, rotated by slot position so they vary across the page.
const BYLINES = [
  "From our Correspondent",
  "From our Special Correspondent",
  "From our Garlic Correspondent",
  "From our Diplomatic Correspondent",
  "By our Staff Reporter",
];

const PARAS_FOR_SIZE: Record<Slot["size"], number> = { xl: 4, lg: 3, md: 2 };

export function transformStory(story: SourceStory, slot: Slot): Article {
  const paras = story.body.slice(0, PARAS_FOR_SIZE[slot.size]);
  return {
    title: story.headline,
    byline: BYLINES[(slot.position - 1) % BYLINES.length],
    size: slot.size,
    columns: slot.columns,
    body: paras.length > 0 ? paras : story.body.slice(0, 1),
    image: slot.hasImage ? story.image : undefined,
    sourceUrl: story.sourceUrl,
  };
}
