import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RatesBox } from "@/edition/components";

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
