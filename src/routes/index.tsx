import { createFileRoute } from "@tanstack/react-router";
import coatOfArms from "@/assets/coat-of-arms.png";
import mainPhoto from "@/assets/main-photo.jpg";
import secondaryPhoto from "@/assets/secondary-photo.jpg";
import advert from "@/assets/advert.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Times — Friday October 3, 1962" },
      {
        name: "description",
        content:
          "The Times — front page edition. Cabinet talks, railway negotiations, foreign affairs, and the daily recipe.",
      },
      { property: "og:title", content: "The Times — Front Page" },
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
    sm: "text-xl leading-[1.1]",
    md: "text-2xl leading-[1.05]",
    lg: "text-3xl leading-[1.02] sm:text-4xl",
    xl: "text-4xl leading-[1] sm:text-5xl",
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
}: {
  title: string;
  byline?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  image?: { src: string; alt: string; caption?: string };
}) {
  return (
    <article className="break-inside-avoid mb-6">
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
      <div className="space-y-3 text-[14px] leading-[1.45]">{children}</div>
    </article>
  );
}

function FrontPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      {/* Masthead */}
      <header>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em]">
          <span>No. 58,419</span>
          <span>Late London Edition</span>
          <span>Price 6d.</span>
        </div>
        <Rule />
        <h1 className="flex items-center justify-center gap-4 sm:gap-8 font-serif font-bold leading-none">
          <span className="text-5xl sm:text-7xl md:text-8xl">The</span>
          <img
            src={coatOfArms}
            alt="Royal coat of arms"
            width={120}
            height={120}
            className="h-16 w-16 sm:h-24 sm:w-24 md:h-28 md:w-28 object-contain"
          />
          <span className="text-5xl sm:text-7xl md:text-8xl">Times</span>
        </h1>
        <Rule />
        <p className="text-center text-[12px] uppercase tracking-[0.3em]">
          London &middot; Friday October 3, 1962 &middot; Sixteen Pages
        </p>
        <Rule thick />
      </header>

      {/* Body — columnar typeset, responsive */}
      <section className="columns-1 gap-8 md:columns-2 lg:columns-3 [column-rule:1px_solid_var(--ink)]">
        <Article
          title="Cabinet talks resume as ministers seek to break impasse"
          byline="From our Political Correspondent"
          size="xl"
          image={{
            src: mainPhoto,
            alt: "Ministers leaving Downing Street",
            caption:
              "The Prime Minister and senior colleagues departing No. 10 after yesterday's prolonged session.",
          }}
        >
          <p>
            After a meeting which lasted into the small hours, the Cabinet
            reassembled in Downing Street yesterday morning to consider afresh
            the terms upon which Her Majesty's Government may proceed with the
            measures outlined in last week's communique. Ministers, it is
            understood, remain divided upon the question of timing, though there
            is now broad acceptance of the principle.
          </p>
          <p>
            The Lord Privy Seal, speaking afterwards to representatives of the
            Press at the door of the Cabinet Office, said only that
            "considerable progress" had been made and that he hoped a further
            statement might be issued before the House rises for the weekend
            recess. Backbench opinion in the Government party is reported to
            have hardened against any further delay, and the Whips' Office has
            been busy throughout the day.
          </p>
          <p>
            In the City the response was cautiously favourable. Sterling held
            firm against the dollar at the close, and gilt-edged stocks were
            marked a shade higher in late dealings. Industrial shares, however,
            showed little change on balance, dealers preferring to await the
            promised ministerial statement before committing themselves.
          </p>
          <p>
            Our Diplomatic Correspondent writes: It is not expected that the
            proposals, when announced, will materially affect the discussions
            now in progress at Geneva, where the British delegation has already
            indicated its willingness to consider a wider range of options than
            had at first appeared probable.
          </p>
        </Article>

        <Article
          title="Beeching and Greene try afresh for a railway peace"
          byline="By Ian Coulter, Industrial Correspondent"
          size="lg"
          image={{
            src: secondaryPhoto,
            alt: "Locomotive at terminus",
            caption: "A morning express prepared for departure at Paddington.",
          }}
        >
          <p>
            A renewed effort by Dr Beeching, chairman of the Transport
            Commission, and Mr Sidney Greene, general secretary of the National
            Union of Railwaymen, to find a basis for the settlement of the long
            dispute over wages and manning is to begin in London next Tuesday.
          </p>
          <p>
            Both sides have intimated, in carefully worded statements, that they
            approach the meeting "in a constructive spirit." Few in the industry
            doubt, however, that the road to agreement will be long, and that
            the question of branch-line closures must sooner or later be
            reckoned with.
          </p>
          <p>
            Mr Greene is understood to be under pressure from a section of his
            executive to insist upon firm assurances on redundancy before any
            wages formula is accepted. Dr Beeching, for his part, is not
            believed to be in a position to give such assurances without
            reference to the Minister of Transport.
          </p>
        </Article>

        <Article
          title="Berlin mercy team turned back at the wire"
          byline="From our Correspondent in Berlin"
          size="md"
        >
          <p>
            A British Army ambulance bound for the French sector with two cases
            of acute appendicitis was halted at Friedrichstrasse last night by
            officers of the People's Police and obliged to return the way it had
            come. No reason was given by the East German authorities.
          </p>
          <p>
            The incident is the third in a fortnight in which routine medical
            traffic between the western sectors has been impeded. The Allied
            commandants have lodged a formal protest with the Soviet commandant
            and are understood to be considering further measures.
          </p>
          <p>
            Civilian crossings at the principal checkpoints proceeded normally
            throughout the day, though queues were noticeably longer than usual
            during the early evening.
          </p>
        </Article>

        <Article
          title="Premier hits back at the critics of the Six"
          byline="By James Margach, Political Correspondent"
          size="md"
        >
          <p>
            Mr Macmillan personally entered the Common Market debate yesterday
            with a vigorous defence of the Government's negotiating posture in
            Brussels. Speaking to a private meeting of Conservative
            backbenchers, he is reported to have urged the party to "hold its
            nerve" and to allow the negotiators "the room they need."
          </p>
          <p>
            His remarks, though not for publication, were widely circulated in
            the Lobby within the hour. They are understood to have been prompted
            by a series of critical leading articles in the provincial Press and
            by the resignation of two junior officers of the Young Conservatives
            on the issue.
          </p>
          <p>
            The Foreign Secretary will make a full statement to the House next
            Wednesday, the day before the Prime Minister flies to Bonn for talks
            with Dr Adenauer.
          </p>
        </Article>

        <Article
          title="Photographs saved by a gift of £32,000"
          byline="From our Arts Reporter"
          size="md"
        >
          <p>
            The collection of nineteenth-century photographs assembled by the
            late Sir Albert Kahn, the threatened dispersal of which was reported
            in these columns last month, has been saved for the nation by an
            anonymous benefaction of £32,000.
          </p>
          <p>
            The Trustees of the National Portrait Gallery announced last night
            that the entire collection — some two thousand prints and an
            equivalent number of glass plates — would be accessible to scholars
            from the New Year and that a representative selection would form the
            basis of a public exhibition in the spring.
          </p>
          <p>
            The donor's wish to remain unidentified has been respected. It is
            understood, however, that he is not himself a photographer.
          </p>
        </Article>
      </section>

      <Rule thick />

      {/* Footer row: recipe | currency | advertisement */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
        {/* Recipe — left */}
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
              <strong>Suet crust:</strong> 8 oz self-raising flour, 4 oz beef
              suet, a pinch of salt, cold water to mix.
            </p>
            <p>
              <strong>Filling:</strong> 1 lb chuck steak, 6 oz ox kidney, 1 small
              onion finely chopped, 1 tablespoonful seasoned flour, ½ pint cold
              beef stock, a dash of Worcestershire sauce.
            </p>
            <p>
              Sift the flour with the salt, stir in the suet and bind with water
              to a soft dough. Line a buttered two-pint basin, reserving a third
              for the lid. Toss the meat in seasoned flour, fill the basin,
              moisten with stock, cover with the pastry lid and seal well. Tie
              with a buttered paper and a floured cloth and steam steadily for
              four hours, replenishing the water as required.
            </p>
          </div>
        </article>

        {/* Currency — middle */}
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
              <tr><td>U.S. Dollar</td><td className="text-right tabular-nums">2.8012</td><td className="text-right tabular-nums">+0.0004</td></tr>
              <tr><td>Canadian Dollar</td><td className="text-right tabular-nums">3.0254</td><td className="text-right tabular-nums">−0.0011</td></tr>
              <tr><td>French Franc</td><td className="text-right tabular-nums">13.74</td><td className="text-right tabular-nums">+0.02</td></tr>
              <tr><td>Deutsche Mark</td><td className="text-right tabular-nums">11.18</td><td className="text-right tabular-nums">unch.</td></tr>
              <tr><td>Swiss Franc</td><td className="text-right tabular-nums">12.10</td><td className="text-right tabular-nums">−0.01</td></tr>
              <tr><td>Italian Lira</td><td className="text-right tabular-nums">1,738</td><td className="text-right tabular-nums">+3</td></tr>
              <tr><td>Dutch Guilder</td><td className="text-right tabular-nums">10.11</td><td className="text-right tabular-nums">+0.01</td></tr>
              <tr className="!border-0"><td>Gold (fine oz.)</td><td className="text-right tabular-nums">£12 9s.</td><td className="text-right tabular-nums">+1s.</td></tr>
            </tbody>
          </table>
        </article>

        {/* Advertisement — right */}
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
      </section>

      <Rule thick />
      <footer className="flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.2em]">
        <span>Printed and Published in London</span>
        <span>&copy; The Times Newspapers</span>
        <span>Page 1</span>
      </footer>
    </main>
  );
}
