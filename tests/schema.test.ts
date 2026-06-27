// tests/schema.test.ts
import { test, expect } from "bun:test";
import { parseEdition } from "@/edition/schema";
import { validEdition } from "./fixtures/valid-edition";

test("accepts a valid edition", () => {
  expect(() => parseEdition(validEdition, "valid.json")).not.toThrow();
});

test("rejects an edition with a missing required field", () => {
  const bad = { ...validEdition, date: undefined };
  expect(() => parseEdition(bad, "bad.json")).toThrow(/bad\.json/);
});

test("rejects a malformed date", () => {
  const bad = { ...validEdition, date: "3 October 1962" };
  expect(() => parseEdition(bad, "bad.json")).toThrow(/date/);
});
