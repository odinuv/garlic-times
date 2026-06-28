import { test, expect } from "bun:test";
import { join } from "node:path";
import { loadRecipes, pickRecipe } from "@/pipeline/recipes";

const FIX = join(import.meta.dir, "..", "fixtures", "pipeline", "recipes");

test("loads recipes sorted by filename", () => {
  const recipes = loadRecipes(FIX);
  expect(recipes).toHaveLength(2);
  expect(recipes.map((r) => r.title)).toEqual(["Recipe One", "Recipe Two"]);
});

test("pickRecipe is deterministic for a given rng", () => {
  const recipes = loadRecipes(FIX);
  const pick = (v: number) => pickRecipe(recipes, () => v).title;
  expect(pick(0)).toBe("Recipe One");
  expect(pick(0.99)).toBe("Recipe Two");
});

test("pickRecipe throws on an empty list", () => {
  expect(() => pickRecipe([], () => 0)).toThrow(/recipe/i);
});
