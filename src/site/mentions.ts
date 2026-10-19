import { strongMatches } from "../collect/relevance.ts";
import type { Story } from "../types.ts";

export interface Mention {
  term: string;
  /** Stories in this set that mention the term. */
  count: number;
  /** Same count for the period before, when there is one to compare with. */
  previous?: number;
}

/**
 * The AI terms a story mentions, by the same rules the collector filters with. Generic ones such as
 * "AI" are left out: every story would carry them.
 */
export function termsOf(story: Story): string[] {
  const ids = strongMatches(`${story.title}\n${story.summary}`)
    .filter((m) => !m.generic)
    .map((m) => m.id);
  return [...new Set(ids)];
}

function count(stories: Story[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const story of stories) {
    for (const term of termsOf(story)) counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return counts;
}

/** Terms mentioned by at least two stories, most mentioned first; risers break ties. */
export function topMentions(stories: Story[], before?: Story[], limit = 8): Mention[] {
  const now = count(stories);
  const then = before ? count(before) : undefined;
  return [...now]
    .filter(([, n]) => n >= 2)
    .map(([term, n]) => ({ term, count: n, previous: then ? (then.get(term) ?? 0) : undefined }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.count - (b.previous ?? 0) - (a.count - (a.previous ?? 0)) ||
        a.term.localeCompare(b.term),
    )
    .slice(0, limit);
}
