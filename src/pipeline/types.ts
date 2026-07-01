import type { EditionImage } from "@/edition/schema";

export type Source = "fox" | "cnn";

export interface SourceStory {
  source: Source;
  headline: string;
  body: string[];
  image?: EditionImage;
}

export interface Slot {
  position: number;
  source: Source;
  size: "xl" | "lg" | "md";
  columns: 1 | 2;
  hasImage: boolean;
}
