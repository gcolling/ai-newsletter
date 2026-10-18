/** Where a source sits in the digest. Drives defaults for topic and ranking. */
export type Section =
  | "labs"
  | "news"
  | "essays"
  | "automation"
  | "releases"
  | "community"
  | "papers";

export type FeedFormat = "rss" | "atom" | "json";

export type TopicId =
  | "models"
  | "agents"
  | "automation"
  | "tools"
  | "research"
  | "infra"
  | "policy"
  | "industry";

export interface Source {
  id: string;
  name: string;
  homepage: string;
  feed: string;
  format: FeedFormat;
  section: Section;
  /** 3 = must-read signal, 1 = useful but noisy. */
  weight: 1 | 2 | 3;
  /** General feeds must match the AI keyword rules to be kept. */
  keywordFilter?: boolean;
  /** Unofficial mirror of a site without its own feed. */
  mirror?: boolean;
  /** Pins every item from this source to one topic. */
  topic?: TopicId;
  /** Releases only: tags matching this are skipped (pre-releases, per-package tags). */
  excludeTags?: RegExp;
  /** Caps very chatty feeds. */
  maxItems?: number;
}

/** An item as parsed from a feed or API, before ranking. */
export interface RawItem {
  sourceId: string;
  title: string;
  url: string;
  summary: string;
  /** ISO 8601. Items without a date are dropped. */
  publishedAt: string;
  discussion?: Discussion;
  paper?: { upvotes: number; arxivId: string };
  release?: { repo: string; version: string };
}

export interface Discussion {
  site: "Hacker News" | "Lobsters";
  url: string;
  points: number;
  comments: number;
}

export interface Story {
  /** Stable across days: derived from the canonical URL. */
  id: string;
  title: string;
  url: string;
  host: string;
  summary: string;
  publishedAt: string;
  source: { id: string; name: string };
  section: Section;
  topic: TopicId;
  score: number;
  /** Plain-language rules that put the story here, e.g. "Covered by 3 outlets". */
  reasons: string[];
  /** Other outlets that covered the same story. */
  also: { source: string; title: string; url: string }[];
  discussion?: Discussion;
  paper?: { upvotes: number; arxivId: string };
  release?: { repo: string; version: string };
}

export interface Issue {
  version: 1;
  /** UTC calendar date of the run, YYYY-MM-DD. */
  date: string;
  generatedAt: string;
  window: { from: string; to: string };
  sources: { total: number; ok: number; failed: string[] };
  /** Sorted by score, highest first. */
  stories: Story[];
}
