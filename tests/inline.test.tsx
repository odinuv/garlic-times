import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInline } from "@/edition/inline";

test("wraps **bold** segments in <strong>", () => {
  const html = renderToStaticMarkup(<p>{renderInline("a **b** c")}</p>);
  expect(html).toBe("<p>a <strong>b</strong> c</p>");
});

test("leaves plain text untouched", () => {
  const html = renderToStaticMarkup(<p>{renderInline("plain")}</p>);
  expect(html).toBe("<p>plain</p>");
});
