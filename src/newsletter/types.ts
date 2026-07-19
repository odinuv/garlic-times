import type { Source } from "@/pipeline/types";

export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

/** One article eligible for the digest, flattened from a weekday edition. */
export interface Candidate {
  id: string; // `${date}#${number}` — stable key for scoring
  date: string; // YYYY-MM-DD of the source edition
  weekday: Weekday;
  number: number; // 1-based article number within that edition
  source: Source;
  title: string;
  dek?: string; // first body paragraph, used as the email blurb
  url: string; // absolute: https://.../<date>/#article-<number>
}

export interface ScoredCandidate extends Candidate {
  score: number; // 0..100 comedic-quality score
  note?: string; // one-line justification (recorded, not emailed)
}

export interface Pick extends ScoredCandidate {
  rank: number; // 1..5 reading-order position in the digest
}

export type Quota = Record<Source, number>;

export interface SelectionResult {
  picks: Pick[];
  fallbacksApplied: string[];
}

/** Written to archive/newsletter/<saturdayDate>.json inside the state tarball. */
export interface DigestRecord {
  saturdayDate: string;
  isoWeek: number;
  weekIsOdd: boolean;
  quota: Quota;
  window: { monday: string; friday: string };
  candidates: ScoredCandidate[];
  picks: Pick[];
  fallbacksApplied: string[];
  sentAt: string; // ISO timestamp, or "" when not sent
  campaignId: string | null; // MailerLite campaign id, or null when unsent
}
