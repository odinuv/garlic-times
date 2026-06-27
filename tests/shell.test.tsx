import { test, expect } from "bun:test";
import { renderDocument } from "@/edition/shell";

test("produces a complete doctype document with head metadata", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hello</main>,
  });
  expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  expect(html).toContain('<html lang="en">');
  expect(html).toContain("<title>T</title>");
  expect(html).toContain('name="description" content="D"');
  expect(html).toContain('href="/styles.css"');
  expect(html).toContain("<main>hello</main>");
});

test("emits no script tags", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
  });
  expect(html).not.toContain("<script");
});
