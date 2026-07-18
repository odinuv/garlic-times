import { test, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SubscribeBox } from "@/edition/subscribe";
import { newsletterConfigFromEnv } from "@/edition/newsletter";

test("newsletterConfigFromEnv returns null when no form action is set", () => {
  expect(newsletterConfigFromEnv({})).toBeNull();
  expect(newsletterConfigFromEnv({ NEWSLETTER_FORM_ACTION: "  " })).toBeNull();
});

test("newsletterConfigFromEnv reads action, email field and hidden fields", () => {
  const cfg = newsletterConfigFromEnv({
    NEWSLETTER_FORM_ACTION: "https://provider.example/subscribe",
    NEWSLETTER_EMAIL_FIELD: "fields[email]",
    NEWSLETTER_HIDDEN_FIELDS: '{"ml-list":"123"}',
  });
  expect(cfg).toEqual({
    action: "https://provider.example/subscribe",
    emailField: "fields[email]",
    hidden: { "ml-list": "123" },
  });
});

test("newsletterConfigFromEnv defaults the email field and tolerates bad hidden JSON", () => {
  const cfg = newsletterConfigFromEnv({
    NEWSLETTER_FORM_ACTION: "https://provider.example/subscribe",
    NEWSLETTER_HIDDEN_FIELDS: "{not json}",
  });
  expect(cfg?.emailField).toBe("email");
  expect(cfg?.hidden).toBeUndefined();
});

test("SubscribeBox renders nothing when unconfigured (nothing broken ships)", () => {
  const html = renderToStaticMarkup(<SubscribeBox config={null} />);
  expect(html).toBe("");
});

test("SubscribeBox renders a POST form with the provider action and email field", () => {
  const html = renderToStaticMarkup(
    <SubscribeBox
      config={{
        action: "https://provider.example/subscribe",
        emailField: "fields[email]",
        hidden: { "ml-list": "123" },
      }}
    />,
  );
  expect(html).toContain('action="https://provider.example/subscribe"');
  expect(html).toContain('method="post"');
  expect(html).toContain('type="email"');
  expect(html).toContain('name="fields[email]"');
  expect(html).toContain('type="hidden"');
  expect(html).toContain('name="ml-list"');
  expect(html).toContain("Subscribe");
  // Hardened target=_blank, matching the share link.
  expect(html).toContain('rel="noopener"');
});

test("SubscribeBox shows a consent line linking to the privacy note when configured", () => {
  const html = renderToStaticMarkup(
    <SubscribeBox
      config={{ action: "https://provider.example/subscribe", emailField: "fields[email]" }}
    />,
  );
  expect(html).toContain("By subscribing you accept our");
  expect(html).toContain('href="/about/#privacy"');
});

test("SubscribeBox ships a JS redirect enhancement to the thank-you page", () => {
  const html = renderToStaticMarkup(
    <SubscribeBox
      config={{ action: "https://provider.example/subscribe", emailField: "fields[email]" }}
    />,
  );
  // The form is tagged for the delegated submit listener, and the script sends a
  // successful signup to our own /subscribed/ page (no-JS falls back to the POST).
  expect(html).toContain('class="js-subscribe');
  expect(html).toContain('location.href="/subscribed/"');
});

test("SubscribeBox consent line only appears when configured", () => {
  const html = renderToStaticMarkup(<SubscribeBox config={null} />);
  expect(html).toBe("");
  expect(html).not.toContain("By subscribing you accept our");
});

test("SubscribeBox posts only the email field and configured hidden inputs (no extra required fields)", () => {
  const html = renderToStaticMarkup(
    <SubscribeBox
      config={{
        action: "https://provider.example/subscribe",
        emailField: "fields[email]",
        hidden: { "ml-list": "123" },
      }}
    />,
  );
  // Exactly two inputs: the email field and the one configured hidden field.
  // A stray `required` input the no-JS POST couldn't satisfy would break signup.
  expect((html.match(/<input/g) || []).length).toBe(2);
  expect((html.match(/required/g) || []).length).toBe(1);
});
