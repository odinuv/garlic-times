// src/edition/subscribe.tsx
// Period-styled newsletter signup box. The Garlic Times is a static site with no
// runtime server, so subscriber capture must be delegated to a third-party form
// endpoint (the browser POSTs straight to the provider). This component is
// *gated*: it renders nothing until a form action is configured, so no
// half-wired form ever ships to production. The config helper lives in
// ./newsletter — this file exports only the component. Once a provider is
// chosen, set the env vars (or pass a config) and mount <SubscribeBox>.
import React from "react";
import { Rule } from "@/edition/components";
import type { NewsletterConfig } from "@/edition/newsletter";

export type { NewsletterConfig } from "@/edition/newsletter";

// Progressive enhancement: the no-JS POST lands the reader on the provider's raw
// `{"success":true}` JSON, because MailerLite's own redirect-to-thank-you-page is
// done by their JavaScript (which we deliberately don't load). When JS is
// available, intercept the submit, fire the same POST in the background, and send
// the reader to our own /subscribed/ page instead. One tiny delegated listener —
// no third-party script, no tracking — mirroring the share-sheet enhancement.
// Without JS the plain POST still subscribes (the double opt-in email is the
// record of consent); only the thank-you redirect is skipped. The redirect is
// optimistic: the response is cross-origin/opaque, so we can't read success and
// send the reader onward regardless — /subscribed/ tells them to check their inbox.
const SUBSCRIBE_SCRIPT =
  'document.addEventListener("submit",function(e){' +
  'var f=e.target;if(!f||!f.classList||!f.classList.contains("js-subscribe"))return;' +
  "e.preventDefault();" +
  'fetch(f.action,{method:"POST",body:new FormData(f),mode:"no-cors"})' +
  '.then(g,g);function g(){location.href="/subscribed/";}});';

/** Newsletter signup box. Renders null when `config` is null (capture not yet wired). */
export function SubscribeBox({ config }: { config: NewsletterConfig | null }) {
  if (!config) return null;
  return (
    <aside className="border border-ink p-4 break-inside-avoid text-center" aria-label="Subscribe">
      <p className="text-[11px] uppercase tracking-[0.25em]">A Digest By Post</p>
      <Rule />
      <h3 className="font-serif text-xl font-bold leading-tight">The Garlic Times, delivered</h3>
      <p className="mb-3 text-[12px] italic leading-snug">
        Each Saturday&rsquo;s edition, free, by electronic mail.
      </p>
      <form
        action={config.action}
        method="post"
        target="_blank"
        rel="noopener"
        className="js-subscribe flex flex-col gap-2 sm:flex-row"
      >
        {config.hidden &&
          Object.entries(config.hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        <input
          type="email"
          name={config.emailField}
          required
          placeholder="your name at some address"
          aria-label="Email address"
          className="flex-1 border border-ink bg-transparent px-2 py-1 text-[13px]"
        />
        <button
          type="submit"
          className="border border-ink px-3 py-1 text-[11px] uppercase tracking-[0.2em]"
        >
          Subscribe
        </button>
      </form>
      {/* On-page consent notice. The form posts only fields[email] (plus any
          configured hidden inputs), so this stays plain text — no required
          MailerLite field or checkbox that the no-JS POST wouldn't submit.
          Double opt-in is the backend record of consent. */}
      <p className="mt-2 text-[10px] italic leading-snug text-muted-foreground">
        By subscribing you accept our{" "}
        <a href="/about/#privacy" className="underline">
          privacy note
        </a>
        .
      </p>
      <script dangerouslySetInnerHTML={{ __html: SUBSCRIBE_SCRIPT }} />
    </aside>
  );
}
