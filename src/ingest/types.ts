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
