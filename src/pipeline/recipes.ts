import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Edition } from "@/edition/schema";

export type Recipe = Edition["recipe"];

export function loadRecipes(recipesDir: string): Recipe[] {
  const files = readdirSync(recipesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.map((f) => JSON.parse(readFileSync(join(recipesDir, f), "utf8")) as Recipe);
}

export function pickRecipe(recipes: Recipe[], rng: () => number): Recipe {
  if (recipes.length === 0) throw new Error("No recipes found in recipe pool");
  return recipes[Math.floor(rng() * recipes.length)];
}
