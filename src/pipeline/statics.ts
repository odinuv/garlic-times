import type { Edition } from "@/edition/schema";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDisplayDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]} ${MONTHS[m - 1]} ${d}, ${y}`;
}

export function staticFields(
  date: string,
): Pick<Edition, "displayDate" | "editionNo" | "strapline" | "price" | "masthead" | "rates" | "advert" | "meta"> {
  const displayDate = formatDisplayDate(date);
  return {
    displayDate,
    editionNo: "No. 58,419",
    strapline: `London · ${displayDate} · Twelve Cloves`,
    price: "Price 6d.",
    masthead: { the: "The", middle: "Garlic", end: "Times", glyph: "/static/new-logo.png" },
    rates: {
      title: "Foreign Exchanges — £1 buys",
      rows: [
        { label: "U.S. Dollar", value: "2.8012", delta: "+0.0004" },
        { label: "Swiss Franc", value: "12.10", delta: "−0.01" },
      ],
    },
    advert: {
      src: "/img/advert.jpg",
      alt: "An advertisement for a fine wristwatch",
      caption: '"The watch that does not tire." — By appointment to discerning gentlemen since 1905. Enquiries to your usual jeweller.',
    },
    meta: {
      title: `The Garlic Times — ${displayDate}`,
      description:
        "The Garlic Times — front page edition. Cabinet talks, railway negotiations, foreign affairs, and the daily recipe.",
    },
  };
}
