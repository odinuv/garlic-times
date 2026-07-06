// tests/fixtures/valid-edition.ts
import type { Edition } from "@/edition/schema";

export const validEdition: Edition = {
  date: "2026-06-27",
  displayDate: "Friday October 3, 1962",
  editionNo: "No. 58,419",
  strapline: "London · Friday October 3, 1962 · Sixteen Pages",
  price: "Price 6d.",
  masthead: { the: "The", middle: "Garlic", end: "Times", glyph: "/static/coat-of-arms.png" },
  articles: [
    {
      title: "Cabinet talks resume",
      byline: "From our Political Correspondent",
      size: "xl",
      columns: 2,
      image: { src: "/img/main.jpg", alt: "Ministers leaving", caption: "Departing No. 10." },
      body: ["First paragraph with a **bold lead-in** and prose.", "Second paragraph."],
      sourceUrl: "https://example.com/original",
    },
    {
      title: "A railway peace",
      byline: "By Ian Coulter",
      size: "lg",
      columns: 1,
      image: { src: "/img/second.jpg", alt: "Locomotive", caption: "A morning express." },
      body: ["Only paragraph."],
    },
    { title: "Berlin mercy team turned back", size: "md", columns: 1, body: ["Body."] },
    { title: "Premier hits back", size: "md", columns: 1, body: ["Body."] },
    { title: "Photographs saved", size: "md", columns: 1, body: ["Body."] },
  ],
  rates: {
    title: "The Garlic Market",
    lead: { label: "Garlic, per kg", usd: "$3.00", eur: "€2.78", delta: "+0.1%" },
    rows: [
      { label: "Crude Oil", value: "74.00", delta: "−1.3%" },
      { label: "Corn, Chicago", value: "455.0", delta: "+1.1%" },
    ],
  },
  recipe: {
    kicker: "From the Kitchen — Recipe of the Day",
    title: "Steak & Kidney Pudding",
    meta: "Serves four. Preparation, half an hour; cooking, four hours.",
    body: ["**Suet crust:** 8 oz flour…", "**Filling:** 1 lb chuck steak…", "Sift the flour…"],
  },
  advert: {
    src: "/img/advert.jpg",
    alt: "A fine wristwatch",
    caption: '"The watch that does not tire."',
  },
  meta: {
    title: "The Garlic Times — Friday October 3, 1962",
    description: "The Garlic Times — front page edition.",
  },
};
