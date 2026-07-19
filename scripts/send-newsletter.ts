// Weekly "Saturday Special" digest: pick 5 of the week's Mon–Fri articles with
// an LLM + deterministic quota, email them via MailerLite, and record the picks
// into the cumulative blob state. Modeled on scripts/analytics-report.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createGeminiComplete, type GeminiComplete } from "@/ingest/gemini";
import { createAzureBlobStore } from "@/archive/blob";
import { saveState } from "@/archive/state";
import { loadWeekCandidates } from "@/newsletter/candidates";
import { rankCandidates } from "@/newsletter/rank";
import { selectPicks } from "@/newsletter/select";
import { renderDigest } from "@/newsletter/render";
import { isoWeek, isoWeekIsOdd, mondayToFriday, quotaForWeek } from "@/newsletter/week";
import { createMailerLiteClient, type Campaign } from "@/newsletter/mailerlite";
import type { DigestRecord } from "@/newsletter/types";
import { todayIso } from "./author-edition";

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
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** A prior run counts as "already sent" only if it recorded a campaign id. */
export function alreadySent(record: DigestRecord | null, force: boolean): boolean {
  return !force && record != null && record.campaignId != null;
}

export function formatDisplayDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow} ${MONTHS[m - 1]} ${d}, ${y}`;
}

export async function buildDigest(opts: {
  contentDir: string;
  date: string;
  complete: GeminiComplete;
}): Promise<{ record: DigestRecord; subject: string; html: string; text: string }> {
  const { contentDir, date, complete } = opts;
  const candidates = loadWeekCandidates(contentDir, date);
  if (candidates.length === 0) {
    throw new Error(`No candidate articles found for the week of ${date}`);
  }
  const scored = await rankCandidates(candidates, complete);
  const quota = quotaForWeek(date);
  const { picks, fallbacksApplied } = selectPicks(scored, quota);
  const week = mondayToFriday(date);
  const { subject, html, text } = renderDigest(picks, { displayDate: formatDisplayDate(date) });
  const record: DigestRecord = {
    saturdayDate: date,
    isoWeek: isoWeek(date),
    weekIsOdd: isoWeekIsOdd(date),
    quota,
    window: { monday: week[0].date, friday: week[4].date },
    candidates: scored,
    picks,
    fallbacksApplied,
    sentAt: "",
    campaignId: null,
  };
  return { record, subject, html, text };
}

async function main(): Promise<void> {
  const date = process.env.NEWSLETTER_DATE?.trim() || todayIso();
  const force = process.env.FORCE_SEND === "1";

  const recordDir = join("archive", "newsletter");
  const recordPath = join(recordDir, `${date}.json`);

  // Read existing record (if any) and skip only if a campaign was actually sent.
  let existing: DigestRecord | null = null;
  if (existsSync(recordPath)) {
    try {
      existing = JSON.parse(readFileSync(recordPath, "utf8")) as DigestRecord;
    } catch {
      existing = null;
    }
  }
  if (alreadySent(existing, force)) {
    console.log(
      `Digest for ${date} already sent (campaignId: ${existing!.campaignId}); skipping. Set FORCE_SEND=1 to override.`,
    );
    return;
  }

  const complete = createGeminiComplete();
  const { record, subject, html, text } = await buildDigest({
    contentDir: "content",
    date,
    complete,
  });
  console.log(`Picked ${record.picks.length} article(s); subject: ${subject}`);
  if (record.fallbacksApplied.length) console.log("Fallbacks:", record.fallbacksApplied.join("; "));

  const apiKey = process.env.MAILERLITE_API_KEY?.trim();
  const groupId = process.env.MAILERLITE_GROUP_ID?.trim();
  const fromName = process.env.MAILERLITE_FROM_NAME?.trim();
  const fromEmail = process.env.MAILERLITE_FROM_EMAIL?.trim();

  // Ensure record dir exists before any external call so we can always write the audit trail.
  if (!existsSync(recordDir)) mkdirSync(recordDir, { recursive: true });

  if (apiKey && groupId && fromName && fromEmail) {
    const campaign: Campaign = { subject, html, plain: text, groupId, fromName, fromEmail };
    try {
      const { id } = await createMailerLiteClient(apiKey).sendCampaign(campaign);
      record.campaignId = id;
      record.sentAt = new Date().toISOString();
      console.log(`Sent MailerLite campaign ${id}.`);
    } catch (err) {
      // Write an audit record (campaignId null) so the failure is traceable, then re-throw.
      writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
      console.log(`Recorded failed-send audit trail to ${recordPath}`);
      throw err;
    }
  } else {
    console.log(
      "MailerLite not configured (MAILERLITE_API_KEY/GROUP_ID/FROM_NAME/FROM_EMAIL); building only, not sending.",
    );
  }

  writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
  console.log(`Recorded picks to ${recordPath}`);

  // Persist the record into the cumulative state tarball when Azure is configured.
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING?.trim();
  const container = process.env.AZURE_STORAGE_CONTAINER?.trim();
  if (connectionString && container) {
    const store = createAzureBlobStore({ connectionString, container });
    await saveState(store, { root: process.cwd(), date, tmpTar: "state-newsletter.tar.gz" });
    console.log("Saved updated state to Azure Blob.");
  } else {
    console.log("Azure Blob not configured; record kept locally only.");
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
