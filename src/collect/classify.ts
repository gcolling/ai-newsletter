import { defaultTopic, topics } from "../topics.ts";
import type { Section, TopicId } from "../types.ts";

export interface Classifiable {
  title: string;
  summary: string;
  section: Section;
}

/** Number of distinct keywords from the topic found in the text. */
function distinctHits(text: string, keywords: RegExp[]): number {
  const seen = new Set<string>();
  for (const keyword of keywords) {
    const flags = keyword.flags.includes("g") ? keyword.flags : `${keyword.flags}g`;
    for (const match of text.matchAll(new RegExp(keyword.source, flags))) {
      seen.add(match[0].toLowerCase());
    }
  }
  return seen.size;
}

/** Keyword score per topic: a title hit counts 2, a summary hit 1. */
export function topicScores(story: Classifiable): Map<TopicId, number> {
  const scores = new Map<TopicId, number>();
  for (const topic of topics) {
    const score =
      2 * distinctHits(story.title, topic.keywords) + distinctHits(story.summary, topic.keywords);
    scores.set(topic.id, score);
  }
  return scores;
}

/**
 * A source's pinned topic wins, papers are research, otherwise the best keyword score. Ties go to
 * the section's default topic, then to the order of src/topics.ts.
 */
export function classifyTopic(story: Classifiable, pinned?: TopicId): TopicId {
  if (pinned) return pinned;
  if (story.section === "papers") return "research";
  const fallback = defaultTopic[story.section];
  const scores = topicScores(story);
  let best: TopicId = fallback;
  let bestScore = scores.get(fallback) ?? 0;
  for (const topic of topics) {
    const score = scores.get(topic.id) ?? 0;
    if (score > bestScore) {
      best = topic.id;
      bestScore = score;
    }
  }
  return best;
}
