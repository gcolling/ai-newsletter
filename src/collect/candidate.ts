import { defaultTopic } from "../topics.ts";
import type { Discussion, Section, Story } from "../types.ts";
import { canonicalUrl, hostOf, storyId } from "./url.ts";

/** Where a candidate came from: a feed in sources.ts or one of the APIs. */
export interface Origin {
  id: string;
  name: string;
  section: Section;
  weight: number;
  mirror?: boolean;
}

/** A story while it is being filtered, merged and ranked. Internal fields never reach the JSON. */
export interface Candidate extends Story {
  /** Canonical URL: the key for ids, dedupe and merging. */
  key: string;
  weight: number;
  mirror: boolean;
  /** Distinct outlets that published this story; grows when clustering merges coverage. */
  outlets: number;
  /**
   * Forum posts whose title fails the AI rules. They may still lend their discussion to a feed
   * story that links the same URL, but never become a story of their own.
   */
  offTopic?: boolean;
}

export interface CandidateInput {
  origin: Origin;
  title: string;
  url: string;
  summary: string;
  publishedAt: Date;
  /** Override the canonical key (feeds whose entries differ only by fragment). */
  key?: string;
  discussion?: Discussion;
  paper?: Story["paper"];
  release?: Story["release"];
}

export function makeCandidate(input: CandidateInput): Candidate {
  const key = input.key ?? canonicalUrl(input.url);
  const candidate: Candidate = {
    id: storyId(key),
    title: input.title,
    url: input.url,
    host: hostOf(input.url),
    summary: input.summary,
    publishedAt: input.publishedAt.toISOString(),
    source: { id: input.origin.id, name: input.origin.name },
    section: input.origin.section,
    topic: defaultTopic[input.origin.section],
    score: 0,
    reasons: [],
    also: [],
    key,
    weight: input.origin.weight,
    mirror: input.origin.mirror ?? false,
    outlets: 1,
  };
  if (input.discussion) candidate.discussion = input.discussion;
  if (input.paper) candidate.paper = input.paper;
  if (input.release) candidate.release = input.release;
  return candidate;
}

/** Copies only the public Story fields, in a fixed order, so the JSON stays tidy and stable. */
export function toStory(c: Candidate): Story {
  const story: Story = {
    id: c.id,
    title: c.title,
    url: c.url,
    host: c.host,
    summary: c.summary,
    publishedAt: c.publishedAt,
    source: c.source,
    section: c.section,
    topic: c.topic,
    score: c.score,
    reasons: c.reasons,
    also: c.also,
  };
  if (c.discussion) story.discussion = c.discussion;
  if (c.paper) story.paper = c.paper;
  if (c.release) story.release = c.release;
  return story;
}
