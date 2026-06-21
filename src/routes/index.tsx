import { createFileRoute } from "@tanstack/react-router";
import coatOfArms from "@/assets/coat-of-arms.png";
import mainPhoto from "@/assets/main-photo.jpg";
import secondaryPhoto from "@/assets/secondary-photo.jpg";
import advert from "@/assets/advert.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Garlic Times — Friday October 3, 1962" },
      {
        name: "description",
        content:
          "The Garlic Times — front page edition. Cabinet talks, railway negotiations, foreign affairs, and the daily recipe.",
      },
      { property: "og:title", content: "The Garlic Times — Front Page" },
      {
        property: "og:description",
        content: "A classic broadsheet front page rendered for the modern web.",
      },
    ],
  }),
  component: FrontPage,
});

function Rule({ thick = false }: { thick?: boolean }) {
  return (
    <hr
      className={`my-3 border-0 bg-ink ${thick ? "h-[3px]" : "h-px"}`}
      aria-hidden
    />
  );
}

function Headline({
  children,
  size = "lg",
  className = "",
}: {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    sm: "text-lg leading-[1.1]",
    md: "text-xl sm:text-2xl leading-[1.05]",
    lg: "text-2xl sm:text-3xl leading-[1.05]",
    xl: "text-3xl sm:text-4xl md:text-5xl leading-[1.02]",
  };
  return (
    <h2 className={`font-serif font-bold tracking-tight ${sizes[size]} ${className}`}>
      {children}
    </h2>
  );
}

function Byline({ children }: { children: React.ReactNode }) {
  return (
    <p className="my-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

function Article({
  title,
  byline,
  children,
  size = "md",
  image,
  columns = 2,
}: {
  title: string;
  byline?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  image?: { src: string; alt: string; caption?: string };
  /** Number of text columns on sm+ screens. 1 = single column always. */
  columns?: 1 | 2;
}) {
  const colsClass =
    columns === 2
      ? "sm:columns-2 sm:gap-5 [column-rule:1px_solid_var(--ink)]"
      : "";
  return (
    <article className="mb-2">
      <Headline size={size} className="mb-1">
        {title}
      </Headline>
      {byline && <Byline>{byline}</Byline>}
      {image && (
        <figure className="my-3">
          <img
            src={image.src}
            alt={image.alt}
            loading="lazy"
            className="w-full grayscale contrast-110"
          />
          {image.caption && (
            <figcaption className="mt-1 text-[11px] italic leading-snug text-muted-foreground">
              {image.caption}
            </figcaption>
          )}
        </figure>
      )}
      <div
        className={`text-[13.5px] leading-[1.45] [&>p]:mb-3 [&>p]:break-inside-avoid ${colsClass}`}
      >
        {children}
      </div>
    </article>
  );
}

function RecipeBox() {
  return (
    <article className="border border-ink p-4">
      <p className="text-center text-[11px] uppercase tracking-[0.25em]">
        From the Kitchen &mdash; Recipe of the Day
      </p>
      <Rule />
      <h3 className="text-center font-serif text-2xl font-bold leading-tight">
        Steak &amp; Kidney Pudding
      </h3>
      <p className="mb-2 text-center text-[11px] italic">
        Serves four. Preparation, half an hour; cooking, four hours.
      </p>
      <Rule />
      <div className="space-y-2 text-[13px] leading-snug">
        <p>
          <strong>Suet crust:</strong> 8 oz self-raising flour, 4 oz beef suet,
          a pinch of salt, cold water to mix.
        </p>
        <p>
          <strong>Filling:</strong> 1 lb chuck steak, 6 oz ox kidney, 1 small
          onion finely chopped, 1 tablespoonful seasoned flour, ½ pint cold beef
          stock, a dash of Worcestershire sauce.
        </p>
        <p>
          Sift the flour with the salt, stir in the suet and bind with water to
          a soft dough. Line a buttered two-pint basin, reserving a third for
          the lid. Toss the meat in seasoned flour, fill the basin, moisten
          with stock, cover with the pastry lid and seal well. Tie with a
          buttered paper and a floured cloth and steam steadily for four hours,
          replenishing the water as required.
        </p>
      </div>
    </article>
  );
}

function FullRatesBox() {
  return (
    <article className="border border-ink p-4">
      <p className="text-center text-[11px] uppercase tracking-[0.25em]">
        Foreign Exchanges
      </p>
      <Rule />
      <h3 className="text-center font-serif text-2xl font-bold leading-tight">
        Sterling Closing Rates
      </h3>
      <p className="mb-2 text-center text-[11px] italic">
        Yesterday's middle market quotations in London.
      </p>
      <Rule />
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-1 font-normal uppercase tracking-wider text-[10px]">
              Currency
            </th>
            <th className="py-1 text-right font-normal uppercase tracking-wider text-[10px]">
              Per £1
            </th>
            <th className="py-1 text-right font-normal uppercase tracking-wider text-[10px]">
              Change
            </th>
          </tr>
        </thead>
        <tbody className="[&_tr]:border-b [&_tr]:border-ink/30 [&_td]:py-1.5">
          <tr>
            <td>U.S. Dollar</td>
            <td className="text-right tabular-nums">2.8012</td>
            <td className="text-right tabular-nums">+0.0004</td>
          </tr>
          <tr className="!border-0">
            <td>Swiss Franc</td>
            <td className="text-right tabular-nums">12.10</td>
            <td className="text-right tabular-nums">−0.01</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

function CompactRatesBox() {
  return (
    <article className="border border-ink p-3">
      <p className="mb-1 text-center text-[10px] uppercase tracking-[0.25em]">
        Foreign Exchanges &mdash; £1 buys
      </p>
      <Rule />
      <table className="w-full text-[13px]">
        <tbody>
          <tr className="border-b border-ink/30">
            <td className="py-1">U.S. Dollar</td>
            <td className="py-1 text-right tabular-nums">2.8012</td>
            <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">+0.0004</td>
          </tr>
          <tr>
            <td className="py-1">Swiss Franc</td>
            <td className="py-1 text-right tabular-nums">12.10</td>
            <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">−0.01</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

function AdvertBox() {
  return (
    <article className="border border-ink p-4 flex flex-col">
      <p className="text-center text-[11px] uppercase tracking-[0.25em]">
        Advertisement
      </p>
      <Rule />
      <img
        src={advert}
        alt="An advertisement for a fine wristwatch"
        loading="lazy"
        className="w-full grayscale contrast-110"
      />
      <Rule />
      <p className="text-center text-[12px] italic">
        "The watch that does not tire." &mdash; By appointment to discerning
        gentlemen since 1905. Enquiries to your usual jeweller.
      </p>
    </article>
  );
}

function FrontPage() {
  const mainArticle = (
    <Article
      title="Cabinet talks resume as ministers seek to break impasse"
      byline="From our Political Correspondent"
      size="xl"
      columns={2}
      image={{
        src: mainPhoto,
        alt: "Ministers leaving Downing Street",
        caption:
          "The Prime Minister and senior colleagues departing No. 10 after yesterday's prolonged session.",
      }}
    >
      <p>
        After a meeting which lasted into the small hours, the Cabinet
        reassembled in Downing Street yesterday morning to consider afresh the
        terms upon which Her Majesty's Government may proceed with the measures
        outlined in last week's communique. Ministers, it is understood, remain
        divided upon the question of timing, though there is now broad
        acceptance of the principle.
      </p>
      <p>
        The Lord Privy Seal, speaking afterwards to representatives of the
        Press at the door of the Cabinet Office, said only that "considerable
        progress" had been made and that he hoped a further statement might be
        issued before the House rises for the weekend recess. Backbench opinion
        in the Government party is reported to have hardened against any
        further delay, and the Whips' Office has been busy throughout the day.
      </p>
      <p>
        In the City the response was cautiously favourable. Sterling held firm
        against the dollar at the close, and gilt-edged stocks were marked a
        shade higher in late dealings. Industrial shares, however, showed
        little change on balance, dealers preferring to await the promised
        ministerial statement before committing themselves.
      </p>
      <p>
        Our Diplomatic Correspondent writes: It is not expected that the
        proposals, when announced, will materially affect the discussions now
        in progress at Geneva, where the British delegation has already
        indicated its willingness to consider a wider range of options than had
        at first appeared probable.
      </p>
    </Article>
  );

  const secondaryArticle = (
    <Article
      title="Beeching and Greene try afresh for a railway peace"
      byline="By Ian Coulter, Industrial Correspondent"
      size="lg"
      columns={1}
      image={{
        src: secondaryPhoto,
        alt: "Locomotive at terminus",
        caption: "A morning express prepared for departure at Paddington.",
      }}
    >
      <p>
        A renewed effort by Dr Beeching, chairman of the Transport Commission,
        and Mr Sidney Greene, general secretary of the National Union of
        Railwaymen, to find a basis for the settlement of the long dispute
        over wages and manning is to begin in London next Tuesday.
      </p>
      <p>
        Both sides have intimated, in carefully worded statements, that they
        approach the meeting "in a constructive spirit." Few in the industry
        doubt, however, that the road to agreement will be long, and that the
        question of branch-line closures must sooner or later be reckoned with.
      </p>
      <p>
        Mr Greene is understood to be under pressure from a section of his
        executive to insist upon firm assurances on redundancy before any
        wages formula is accepted.
      </p>
    </Article>
  );

  const article3 = (
    <Article
      title="Berlin mercy team turned back at the wire"
      byline="From our Correspondent in Berlin"
      size="md"
      columns={1}
    >
      <p>
        A British Army ambulance bound for the French sector with two cases of
        acute appendicitis was halted at Friedrichstrasse last night by
        officers of the People's Police and obliged to return the way it had
        come. No reason was given by the East German authorities.
      </p>
      <p>
        The incident is the third in a fortnight in which routine medical
        traffic between the western sectors has been impeded. The Allied
        commandants have lodged a formal protest with the Soviet commandant
        and are understood to be considering further measures.
      </p>
    </Article>
  );

  const article4 = (
    <Article
      title="Premier hits back at the critics of the Six"
      byline="By James Margach, Political Correspondent"
      size="md"
      columns={1}
    >
      <p>
        Mr Macmillan personally entered the Common Market debate yesterday
        with a vigorous defence of the Government's negotiating posture in
        Brussels. Speaking to a private meeting of Conservative backbenchers,
        he is reported to have urged the party to "hold its nerve" and to
        allow the negotiators "the room they need."
      </p>
      <p>
        His remarks, though not for publication, were widely circulated in the
        Lobby within the hour. They are understood to have been prompted by a
        series of critical leading articles in the provincial Press.
      </p>
    </Article>
  );

  const article5 = (
    <Article
      title="Photographs saved by a gift of £32,000"
      byline="From our Arts Reporter"
      size="md"
      columns={1}
    >
      <p>
        The collection of nineteenth-century photographs assembled by the late
        Sir Albert Kahn, the threatened dispersal of which was reported in
        these columns last month, has been saved for the nation by an
        anonymous benefaction of £32,000.
      </p>
      <p>
        The Trustees of the National Portrait Gallery announced last night
        that the entire collection — some two thousand prints and an
        equivalent number of glass plates — would be accessible to scholars
        from the New Year.
      </p>
    </Article>
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      {/* Masthead */}
      <header>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] sm:text-[11px]">
          <span>No. 58,419</span>
          <span className="hidden sm:inline">Late London Edition</span>
          <span>Price 6d.</span>
        </div>
        <Rule />
        <h1 className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 font-serif font-bold leading-none">
          <span className="text-2xl sm:text-5xl md:text-7xl">The</span>
          <span className="text-2xl sm:text-5xl md:text-7xl italic">Garlic</span>
          <img
            src={coatOfArms}
            alt="Royal coat of arms"
            width={120}
            height={120}
            className="h-10 w-10 sm:h-20 sm:w-20 md:h-24 md:w-24 object-contain shrink-0"
          />
          <span className="text-2xl sm:text-5xl md:text-7xl">Times</span>
        </h1>
        <Rule />
        <p className="text-center text-[10px] uppercase tracking-[0.25em] sm:text-[12px] sm:tracking-[0.3em]">
          London &middot; Friday October 3, 1962 &middot; Sixteen Pages
        </p>
        <Rule thick />
      </header>

      {/* Main grid: flex column on mobile (with custom order), 3-col grid on md+ */}
      <section className="flex flex-col gap-6 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-6">
        {/* Main article — mobile order 1; desktop spans 2 cols on row 1 */}
        <div className="order-1 md:order-none md:col-span-2 md:row-start-1">
          {mainArticle}
        </div>

        {/* Compact rates — mobile only, order 2 */}
        <div className="order-2 md:hidden">
          <CompactRatesBox />
        </div>

        {/* Secondary article — mobile order 3; desktop col 3 row 1 */}
        <div className="order-3 md:order-none md:col-start-3 md:row-start-1">
          {secondaryArticle}
        </div>

        {/* Advert — mobile order 4 (between secondary and the rest);
            desktop in the footer row (col 3, row 3) */}
        <div className="order-4 md:order-none md:col-start-3 md:row-start-3">
          <AdvertBox />
        </div>

        {/* Three text articles — desktop row 2, one per column */}
        <div className="order-5 md:order-none md:col-start-1 md:row-start-2">
          {article3}
        </div>
        <div className="order-6 md:order-none md:col-start-2 md:row-start-2">
          {article4}
        </div>
        <div className="order-7 md:order-none md:col-start-3 md:row-start-2">
          {article5}
        </div>

        {/* Recipe — mobile order 8 (last); desktop footer row col 1 */}
        <div className="order-8 md:order-none md:col-start-1 md:row-start-3">
          <RecipeBox />
        </div>

        {/* Full rates — desktop only, footer row col 2 */}
        <div className="hidden md:block md:col-start-2 md:row-start-3">
          <FullRatesBox />
        </div>
      </section>

      <Rule thick />
      <footer className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.2em] sm:text-[11px]">
        <span>Printed and Published in London</span>
        <span>&copy; The Garlic Times Newspapers</span>
        <span>Page 1</span>
      </footer>
    </main>
  );
}
