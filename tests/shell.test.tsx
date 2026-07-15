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

test("emits no script tags when no analytics beacon token is provided", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
  });
  expect(html).not.toContain("<script");
});

test("emits the Cloudflare Web Analytics beacon when a token is provided", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
    analyticsBeaconToken: "abc123token",
  });
  expect(html).toContain("https://static.cloudflareinsights.com/beacon.min.js");
  expect(html).toContain('data-cf-beacon="{&quot;token&quot;:&quot;abc123token&quot;}"');
  expect(html).toContain("defer");
});

test("ignores an empty analytics beacon token (stays script-free)", () => {
  const html = renderDocument({
    title: "T",
    description: "D",
    faviconHref: "/static/coat-of-arms.png",
    body: <main>hi</main>,
    analyticsBeaconToken: "",
  });
  expect(html).not.toContain("<script");
});
