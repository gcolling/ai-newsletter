import type { Source } from "../types.ts";
import { type Candidate, makeCandidate } from "./candidate.ts";
import { COMMUNITY_LOOKBACK_HOURS } from "./hn.ts";
import type { Window } from "./rank.ts";
import { isDenied, isRelevantTitle } from "./relevance.ts";
import { makeSummary } from "./text.ts";
import { cleanUrl } from "./url.ts";

export const LOBSTERS_MIN_SCORE = 10;

/** Tags that make a story about AI by definition. "vibecoding" is applied too loosely to count. */
const AI_TAGS = new Set(["ai", "ml"]);

export interface LobstersStory {
  short_id: string;
  created_at: string;
  title: string;
  url: string;
  score: number;
  comment_count?: number;
  description?: string;
  comments_url: string;
  tags?: string[];
}

function isStory(value: unknown): value is LobstersStory {
  const s = value as Partial<LobstersStory> | null;
  return (
    typeof s?.title === "string" &&
    typeof s.score === "number" &&
    typeof s.created_at === "string" &&
    typeof s.comments_url === "string"
  );
}

export function parseLobsters(json: unknown): LobstersStory[] {
  if (!Array.isArray(json)) throw new Error("unexpected Lobsters response");
  return json.filter(isStory);
}

/**
 * Tagged ai/ml, or a title that passes the Hacker News rule. Threads about Lobsters itself
 * ("meta") never belong in the digest.
 */
export function isRelevantLobsters(story: Pick<LobstersStory, "title" | "tags">): boolean {
  const tags = story.tags ?? [];
  if (tags.includes("meta")) return false;
  return tags.some((tag) => AI_TAGS.has(tag)) || isRelevantTitle(story.title);
}

/**
 * Recent, well-scored stories; irrelevant ones are marked off-topic. Text posts link to their
 * own thread.
 */
export function lobstersCandidates(
  stories: LobstersStory[],
  source: Source,
  window: Window,
  summaryLength: number,
): Candidate[] {
  const from = window.from.getTime() - COMMUNITY_LOOKBACK_HOURS * 3600_000;
  return stories.flatMap((story) => {
    const created = new Date(story.created_at);
    if (Number.isNaN(created.getTime())) return [];
    if (created.getTime() <= from || created > window.to) return [];
    if (story.score < LOBSTERS_MIN_SCORE) return [];
    const title = story.title.trim();
    const summary = makeSummary(title, story.description ?? "", "", summaryLength);
    if (isDenied(title, summary)) return [];
    const url = (story.url && cleanUrl(story.url)) || story.comments_url;
    const candidate = makeCandidate({
      origin: source,
      title,
      url,
      summary,
      publishedAt: created,
      discussion: {
        site: "Lobsters",
        url: story.comments_url,
        points: story.score,
        comments: story.comment_count ?? 0,
      },
    });
    candidate.offTopic = !isRelevantLobsters(story);
    return [candidate];
  });
}
