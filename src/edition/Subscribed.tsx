// src/edition/Subscribed.tsx
// Thank-you page the newsletter provider (MailerLite) redirects to after a
// successful signup — its custom success URL points at /subscribed/. Period-
// styled to match the paper: masthead glyph, serif heading, a Rule, and a way
// back to the front page. A utility page (noindex), so it carries no navigation
// chrome of its own.
import React from "react";
import { Rule } from "@/edition/components";

/** Confirmation page shown after a reader submits the signup form. */
export function SubscribedPage({ glyph }: { glyph: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16 text-center">
      <img
        src={glyph}
        alt="The Garlic Times emblem"
        width={96}
        height={96}
        className="mx-auto h-20 w-20 object-contain mix-blend-multiply"
      />
      <p className="mt-6 text-[11px] uppercase tracking-[0.25em]">A Digest By Post</p>
      <Rule />
      <h1 className="font-serif text-3xl font-bold leading-tight sm:text-4xl">
        Your subscription has taken root
      </h1>
      <p className="mt-4 text-[14px] italic leading-snug">
        A confirmation email is heading your way. Give it a quick nod, and fresh cloves of news will
        follow.
      </p>
      <Rule />
      <p className="text-[11px] uppercase tracking-[0.25em]">
        <a href="/" className="no-underline">
          ‹ Return to the front page
        </a>
      </p>
    </main>
  );
}
