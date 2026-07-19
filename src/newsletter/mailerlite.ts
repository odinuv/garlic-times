const API = "https://connect.mailerlite.com/api";

export interface Campaign {
  subject: string;
  html: string;
  plain: string;
  groupId: string;
  fromName: string;
  fromEmail: string;
}

export interface MailerLiteClient {
  sendCampaign(c: Campaign): Promise<{ id: string }>;
}

type MlResponse = { data?: { id?: string | number }; message?: string; error?: string };

export function createMailerLiteClient(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): MailerLiteClient {
  async function call(path: string, body: unknown): Promise<MlResponse> {
    const res = await fetchImpl(`${API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as MlResponse;
    if (!res.ok) {
      throw new Error(
        `MailerLite ${path} failed (${res.status}): ${json.message ?? json.error ?? res.statusText}`,
      );
    }
    return json;
  }

  return {
    async sendCampaign(c) {
      const created = await call("/campaigns", {
        name: c.subject,
        type: "regular",
        emails: [
          {
            subject: c.subject,
            from_name: c.fromName,
            from: c.fromEmail,
            content: c.html,
          },
        ],
        groups: [c.groupId],
      });
      const id = String(created.data?.id ?? "");
      if (!id) throw new Error("MailerLite: campaign create returned no id");
      await call(`/campaigns/${id}/schedule`, { delivery: "instant" });
      return { id };
    },
  };
}

export function createFakeMailerLiteClient(sink: Campaign[]): MailerLiteClient {
  return {
    async sendCampaign(c) {
      sink.push(c);
      return { id: `fake_${sink.length}` };
    },
  };
}
