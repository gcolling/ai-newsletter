import { type Candidate, makeCandidate } from "../../src/collect/candidate.ts";
import type { Window } from "../../src/collect/rank.ts";
import type { Discussion, Section, Source } from "../../src/types.ts";

/** Every test runs at the same fixed moment: Sunday 2026-10-18, 06:00 UTC. */
export const NOW = new Date("2026-10-18T06:00:00Z");

/** A 24-hour issue window ending at NOW. */
export const WINDOW: Window = { from: new Date("2026-10-17T06:00:00Z"), to: NOW };

export function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3600_000);
}

export function testSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "test-source",
    name: "Test Source",
    homepage: "https://example.com/",
    feed: "https://example.com/feed.xml",
    format: "rss",
    section: "news",
    weight: 2,
    ...overrides,
  };
}

export interface StoryFixture {
  title: string;
  url?: string;
  summary?: string;
  sourceId?: string;
  sourceName?: string;
  section?: Section;
  weight?: number;
  mirror?: boolean;
  publishedAt?: Date;
  discussion?: Discussion;
  paper?: Candidate["paper"];
  release?: Candidate["release"];
}

let counter = 0;

/** A candidate story with sensible defaults; only spell out what a test is about. */
export function story(fixture: StoryFixture): Candidate {
  counter += 1;
  const sourceId = fixture.sourceId ?? "test-source";
  return makeCandidate({
    origin: {
      id: sourceId,
      name: fixture.sourceName ?? sourceId,
      section: fixture.section ?? "news",
      weight: fixture.weight ?? 2,
      mirror: fixture.mirror ?? false,
    },
    title: fixture.title,
    url: fixture.url ?? `https://example.com/story-${counter}`,
    summary: fixture.summary ?? "",
    publishedAt: fixture.publishedAt ?? hoursAgo(12),
    discussion: fixture.discussion,
    paper: fixture.paper,
    release: fixture.release,
  });
}
