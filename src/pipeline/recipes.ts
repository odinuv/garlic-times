import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Edition } from "@/edition/schema";
import { dayOfYear } from "@/pipeline/selection";

export type Recipe = Edition["recipe"];

// The whole recipe pool lives in one file (an array of recipes), shuffled once
// at build time. loadRecipes just reads it back.
export function loadRecipes(recipesDir: string): Recipe[] {
  const raw = readFileSync(join(recipesDir, "recipes.json"), "utf8");
  return JSON.parse(raw) as Recipe[];
}

// Pick the recipe of the day deterministically: day-of-year modulo the pool
// size. With a shuffled pool this walks the whole list across the year, so a
// given recipe never lands on the same calendar day twice within a year.
export function pickRecipe(recipes: Recipe[], date: string): Recipe {
  if (recipes.length === 0) throw new Error("No recipes found in recipe pool");
  return recipes[dayOfYear(date) % recipes.length];
}
