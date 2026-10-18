import { type Candidate, makeCandidate, type Origin } from "./candidate.ts";
import type { Window } from "./rank.ts";
import { isDenied, isRelevantTitle } from "./relevance.ts";
import { cleanUrl } from "./url.ts";

export const hackerNews: Origin = {
  id: "hacker-news",
  name: "Hacker News",
  section: "community",
  weight: 1,
};

export const HN_MIN_POINTS = 20;
/** Points take hours to accrue, so look back further than the issue window. */
export const COMMUNITY_LOOKBACK_HOURS = 12;

export interface HnHit {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  num_comments: number | null;
  created_at_i: number;
}

export function hnSearchUrl(window: Window): string {
  const since = Math.floor(window.from.getTime() / 1000) - COMMUNITY_LOOKBACK_HOURS * 3600;
  const until = Math.floor(window.to.getTime() / 1000);
  const params = new URLSearchParams({
    tags: "story",
    numericFilters: `created_at_i>${since},created_at_i<=${until},points>=${HN_MIN_POINTS}`,
    hitsPerPage: "1000",
    attributesToRetrieve: "title,url,points,num_comments,created_at_i,objectID",
    attributesToHighlight: "none",
  });
  return `https://hn.algolia.com/api/v1/search_by_date?${params}`;
}

function isHit(value: unknown): value is HnHit {
  const hit = value as Partial<HnHit> | null;
  return (
    typeof hit?.objectID === "string" &&
    typeof hit.title === "string" &&
    typeof hit.points === "number" &&
    typeof hit.created_at_i === "number"
  );
}

export function parseHnHits(json: unknown): HnHit[] {
  const hits = (json as { hits?: unknown } | null)?.hits;
  if (!Array.isArray(hits)) throw new Error("unexpected Algolia response");
  return hits.filter(isHit);
}

/**
 * Stories with enough points inside the (extended) window. Titles that fail the AI rule are kept
 * but marked off-topic. Text posts (Ask HN) link to the thread itself.
 */
export function hnCandidates(hits: HnHit[], window: Window): Candidate[] {
  const from = window.from.getTime() - COMMUNITY_LOOKBACK_HOURS * 3600_000;
  return hits.flatMap((hit) => {
    const created = new Date(hit.created_at_i * 1000);
    if (created.getTime() <= from || created > window.to) return [];
    if (hit.points < HN_MIN_POINTS) return [];
    if (isDenied(hit.title, "")) return [];
    const thread = `https://news.ycombinator.com/item?id=${hit.objectID}`;
    const url = (hit.url && cleanUrl(hit.url)) || thread;
    const candidate = makeCandidate({
      origin: hackerNews,
      title: hit.title.trim(),
      url,
      summary: "",
      publishedAt: created,
      discussion: {
        site: "Hacker News",
        url: thread,
        points: hit.points,
        comments: hit.num_comments ?? 0,
      },
    });
    candidate.offTopic = !isRelevantTitle(candidate.title);
    return [candidate];
  });
}
