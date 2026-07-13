import type { Edition } from "@/edition/schema";
import { computeRates, type MarketSnapshot } from "@/pipeline/market";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatDisplayDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]} ${MONTHS[m - 1]} ${d}, ${y}`;
}

// A plausible, ever-rising edition number: ~1.3 per day since 1920-01-01
// (≈ 50,000 in 2026). Deterministic from the date, so builds stay reproducible.
export function editionNumber(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const days = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(1920, 0, 1)) / 86_400_000);
  return `No. ${Math.round(days * 1.3).toLocaleString("en-US")}`;
}

export function staticFields(
  date: string,
  market: MarketSnapshot,
): Pick<
  Edition,
  "displayDate" | "editionNo" | "strapline" | "price" | "masthead" | "rates" | "advert" | "meta"
> {
  const displayDate = formatDisplayDate(date);
  return {
    displayDate,
    editionNo: editionNumber(date),
    strapline: `EU · ${displayDate} · Twelve Cloves`,
    price: "Price 6G.",
    masthead: { the: "The", middle: "Garlic", end: "Times", glyph: "/static/new-logo.png" },
    rates: computeRates(market),
    advert: {
      src: "/img/advert.jpg",
      alt: "An advertisement for a fine wristwatch",
      caption:
        '"The watch that does not tire." — By appointment to discerning gentlemen since 1905. Enquiries to your usual jeweller.',
    },
    meta: {
      title: `The Garlic Times — ${displayDate}`,
      description:
        "The Garlic Times — front page edition. Cabinet talks, railway negotiations, foreign affairs, and the daily recipe.",
    },
  };
}
