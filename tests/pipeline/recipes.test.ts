import { test, expect } from "bun:test";
import { join } from "node:path";
import { loadRecipes, pickRecipe } from "@/pipeline/recipes";

const FIX = join(import.meta.dir, "..", "fixtures", "pipeline", "recipes");

test("loads recipes from the combined recipes.json in file order", () => {
  const recipes = loadRecipes(FIX);
  expect(recipes).toHaveLength(2);
  expect(recipes.map((r) => r.title)).toEqual(["Recipe One", "Recipe Two"]);
});

test("pickRecipe selects by day-of-year modulo pool size", () => {
  const recipes = loadRecipes(FIX);
  // 2 recipes: even day-of-year -> index 0, odd -> index 1
  expect(pickRecipe(recipes, "2026-01-02").title).toBe("Recipe One"); // dayOfYear 2 -> 0
  expect(pickRecipe(recipes, "2026-01-01").title).toBe("Recipe Two"); // dayOfYear 1 -> 1
});

test("pickRecipe is deterministic for a given date", () => {
  const recipes = loadRecipes(FIX);
  expect(pickRecipe(recipes, "2026-03-14")).toEqual(pickRecipe(recipes, "2026-03-14"));
});

test("pickRecipe throws on an empty list", () => {
  expect(() => pickRecipe([], "2026-01-01")).toThrow(/recipe/i);
});
