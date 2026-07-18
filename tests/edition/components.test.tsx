import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleBlock, RatesBox } from "@/edition/components";
import { validEdition } from "../fixtures/valid-edition";

const rates = {
  title: "The Garlic Market",
  lead: { label: "Garlic, per kg", usd: "$3.12", eur: "€3.12", delta: "+4.0%" },
  rows: [
    { label: "Corn, Chicago", value: "495.0", delta: "+10.0%" },
    { label: "Crude Oil", value: "75.00", delta: "+0.0%" },
  ],
};

test("RatesBox renders the title, garlic lead, and mover rows", () => {
  const html = renderToStaticMarkup(<RatesBox rates={rates} />);
  expect(html).toContain("The Garlic Market");
  expect(html).toContain("Garlic, per kg");
  expect(html).toContain("$3.12");
  expect(html).toContain("€3.12");
  expect(html).toContain("+4.0%");
  expect(html).toContain("Corn, Chicago");
  expect(html).toContain("Crude Oil");
});

test("engagement icons and the read-more link carry hover tooltips", () => {
  // articles[0] has a sourceUrl, so the ">>" read-more link is rendered too.
  const article = validEdition.articles[0];
  const html = renderToStaticMarkup(
    <ArticleBlock article={article} number={1} date="2026-06-27" />,
  );
  expect(html).toContain('title="Like this article"');
  expect(html).toContain('title="Share this article"');
  expect(html).toContain('title="Read the original article"');
});
