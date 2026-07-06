import { join } from "node:path";
import { parseEdition, type Edition } from "@/edition/schema";
import type { Source, SourceStory } from "@/pipeline/types";
import { assignSlots, pickStories } from "@/pipeline/selection";
import { loadSourceStories } from "@/pipeline/sources";
import { loadRecipes, pickRecipe } from "@/pipeline/recipes";
import { transformStory } from "@/pipeline/transform";
import { staticFields } from "@/pipeline/statics";
import { mulberry32, seedFromDate } from "@/pipeline/rng";

export function buildEdition(opts: {
  date: string;
  contentDir: string;
  rng?: () => number;
}): Edition {
  const { date, contentDir } = opts;
  const rng = opts.rng ?? mulberry32(seedFromDate(date));

  const sourcesDir = join(contentDir, "sources");
  const pools: Record<Source, SourceStory[]> = {
    fox: loadSourceStories(sourcesDir, "fox"),
    cnn: loadSourceStories(sourcesDir, "cnn"),
  };

  const slots = assignSlots(date);
  const stories = pickStories(slots, pools, rng);
  const articles = stories.map((story, i) => transformStory(story, slots[i]));

  const recipes = loadRecipes(join(contentDir, "recipes"));
  const recipe = pickRecipe(recipes, date);

  const edition = { date, ...staticFields(date), articles, recipe };
  return parseEdition(edition, `${date}.json`);
}
