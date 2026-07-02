import type { Source } from "@/pipeline/types";

export interface FeedItem {
  title: string;
  url: string;
}

export interface Candidate {
  source: Source;
  url: string;
  title: string;
  bodyMarkdown: string;
  imageUrl?: string;
}

export interface GarlicTitled extends Candidate {
  garlicTitle: string;
  swappedTerm: string;
  isMaga: boolean;
}

export interface GarlicArticle extends GarlicTitled {
  body: string[];
  illustration?: Uint8Array; // B&W courtroom-sketch bytes, set when illustrated
}
