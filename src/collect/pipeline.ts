import type { Source, TopicId } from "../types.ts";
import type { Candidate } from "./candidate.ts";
import { classifyTopic } from "./classify.ts";
import { attachDiscussions, clusterStories } from "./cluster.ts";
import { rankAll, rankStory, type Window } from "./rank.ts";
import { isSeen, type Seen } from "./store.ts";

/** No single source may fill the issue. */
export const SOURCE_CAP = 8;

export interface StoryInputs {
  /** Candidates per feed source that fetched and parsed fine. */
  feeds: { source: Source; candidates: Candidate[] }[];
  /** Hacker News and Lobsters posts, one list per site; off-topic ones only lend discussions. */
  community: Candidate[][];
  papers: Candidate[];
  seen: Seen;
  window: Window;
  /** Topic pins from src/sources.ts, by source id. */
  pinnedTopics: Map<string, TopicId>;
}

/** Keeps the `limit` best candidates, judged on their own (before merging with other outlets). */
export function capBySource(candidates: Candidate[], limit: number, window: Window): Candidate[] {
  if (candidates.length <= limit) return candidates;
  return [...candidates]
    .sort((a, b) => rankStory(b, window).score - rankStory(a, window).score)
    .slice(0, limit);
}

function uniqueById(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => !seen.has(c.id) && seen.add(c.id));
}

/**
 * Everything between fetching and writing: dedupe against history, attach forum discussions,
 * cap each source, classify, merge duplicates across outlets and rank.
 */
export function assembleStories(inputs: StoryInputs): Candidate[] {
  const { seen, window } = inputs;
  const fresh = (list: Candidate[]) => list.filter((c) => !isSeen(c, seen));

  const feedGroups = inputs.feeds.map(({ source, candidates }) => ({
    source,
    candidates: fresh(candidates),
  }));
  const feedStories = feedGroups.flatMap((g) => g.candidates);

  const communityStories = inputs.community.flatMap((posts) => {
    const unmatched = attachDiscussions(feedStories, fresh(posts));
    return capBySource(
      unmatched.filter((post) => !post.offTopic),
      SOURCE_CAP,
      window,
    );
  });

  const capped = feedGroups.flatMap(({ source, candidates }) =>
    capBySource(candidates, Math.min(source.maxItems ?? SOURCE_CAP, SOURCE_CAP), window),
  );

  const all = [...capped, ...communityStories, ...fresh(inputs.papers)];
  for (const c of all) c.topic = classifyTopic(c, inputs.pinnedTopics.get(c.source.id));

  return uniqueById(rankAll(clusterStories(all), window));
}
