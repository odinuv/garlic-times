import { test, expect } from "bun:test";
import {
  createFakeMailerLiteClient,
  createMailerLiteClient,
  type Campaign,
} from "@/newsletter/mailerlite";

const campaign: Campaign = {
  subject: "S",
  html: "<b>h</b>",
  plain: "h",
  groupId: "g1",
  fromName: "The Garlic Times",
  fromEmail: "post@thegarlictimes.com",
};

test("fake client captures the campaign and returns an id", async () => {
  const sink: Campaign[] = [];
  const res = await createFakeMailerLiteClient(sink).sendCampaign(campaign);
  expect(sink).toHaveLength(1);
  expect(sink[0].subject).toBe("S");
  expect(res.id).toBeTruthy();
});

test("real client creates then schedules the campaign via the API", async () => {
  const calls: { url: string; method?: string; body: unknown }[] = [];
  const fakeFetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method,
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    const id = "camp_123";
    const payload = String(url).endsWith("/schedule") ? { data: { id } } : { data: { id } };
    return new Response(JSON.stringify(payload), {
      status: String(url).endsWith("/schedule") ? 200 : 201,
    });
  }) as unknown as typeof fetch;

  const client = createMailerLiteClient("key_abc", fakeFetch);
  const res = await client.sendCampaign(campaign);
  expect(res.id).toBe("camp_123");
  expect(calls[0].url).toContain("/api/campaigns");
  expect(calls[0].method).toBe("POST");
  expect(calls[1].url).toContain("/api/campaigns/camp_123/schedule");
});

test("real client throws on a non-2xx response", async () => {
  const fakeFetch = (async () =>
    new Response(JSON.stringify({ message: "bad key" }), {
      status: 401,
    })) as unknown as typeof fetch;
  const client = createMailerLiteClient("key_abc", fakeFetch);
  await expect(client.sendCampaign(campaign)).rejects.toThrow(/MailerLite/);
});
