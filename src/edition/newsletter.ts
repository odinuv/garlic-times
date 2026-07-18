// src/edition/newsletter.ts
// Newsletter capture configuration, split out from the <SubscribeBox> component
// so the component file exports only components (React Fast Refresh constraint).
// The Garlic Times is a static site with no runtime server, so subscriber
// capture is delegated to a third-party form endpoint (the browser POSTs
// straight to the provider). Because the provider / account is a vendor decision
// owned by the CEO, capture is *gated*: absent config => the signup box renders
// nothing, so no half-wired form ever ships to production.

export interface NewsletterConfig {
  /** Provider form endpoint the browser POSTs to (e.g. a MailerLite/Buttondown embed URL). */
  action: string;
  /** Name attribute the provider expects for the email field. */
  emailField: string;
  /** Provider hidden fields (list id, redirect, etc.), rendered as hidden inputs. */
  hidden?: Record<string, string>;
}

/**
 * Build a NewsletterConfig from environment, or null when unconfigured.
 * NEWSLETTER_FORM_ACTION is the switch: absent/empty => capture is off.
 */
export function newsletterConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): NewsletterConfig | null {
  const action = env.NEWSLETTER_FORM_ACTION?.trim();
  if (!action) return null;

  let hidden: Record<string, string> | undefined;
  const rawHidden = env.NEWSLETTER_HIDDEN_FIELDS?.trim();
  if (rawHidden) {
    try {
      const parsed = JSON.parse(rawHidden);
      if (parsed && typeof parsed === "object") hidden = parsed as Record<string, string>;
    } catch {
      // Ignore malformed hidden-field JSON rather than break the build.
    }
  }

  return {
    action,
    emailField: env.NEWSLETTER_EMAIL_FIELD?.trim() || "email",
    hidden,
  };
}
