import type { Discussion } from "../types.ts";
import type { Candidate } from "./candidate.ts";
import { strongMatches } from "./relevance.ts";

export interface Window {
  from: Date;
  to: Date;
}

export interface Ranking {
  score: number;
  reasons: string[];
}

const MAX_REASONS = 4;
const FUNDING = /\b(?:raises|raised|raising)\b[^.]{0,40}[$€£]\s?\d|\bSeries [A-F]\b/;

function plural(count: number, noun: string): string {
  return `${count.toLocaleString("en-US")} ${noun}${count === 1 ? "" : "s"}`;
}

/** Points weigh twice as much as comments; both flatten out on a log scale. */
export function discussionScore(d: Discussion): number {
  return 6 * Math.log2(1 + d.points / 50) + 3 * Math.log2(1 + d.comments / 50);
}

export function paperScore(upvotes: number): number {
  return 8 * Math.log2(1 + upvotes / 50);
}

export function recencyScore(publishedAt: string, window: Window): number {
  const length = window.to.getTime() - window.from.getTime();
  if (length <= 0) return 0;
  const age = window.to.getTime() - new Date(publishedAt).getTime();
  return Math.min(6, Math.max(0, 6 * (1 - age / length)));
}

/** "Matched: agents, MCP" with the words as the text wrote them; generic ones like "AI" left out. */
function matchedReason(texts: string[]): string | undefined {
  const shown: string[] = [];
  for (const text of texts) {
    const lower = text.toLowerCase();
    if (shown.some((s) => s.toLowerCase() === lower)) continue;
    shown.push(text);
    if (shown.length === 3) break;
  }
  return shown.length > 0 ? `Matched: ${shown.join(", ")}` : undefined;
}

const WEIGHT_LABEL = ["", "Useful source", "Solid source", "Must-read source"];

function sourceLabel(c: Candidate): string | undefined {
  // Mirrors only copy a lab's own posts, so those still count as official.
  if (c.section === "labs") return "Official announcement";
  if (c.section === "essays") return "From a followed writer";
  if (c.section === "releases") return "New release";
  return undefined;
}

/**
 * Score and reader-facing reasons. Reasons go from strongest evidence to weakest: outside signals
 * (coverage, discussion, upvotes) by points, then what kind of source it is, then keywords.
 */
export function rankStory(c: Candidate, window: Window): Ranking {
  const signals: { points: number; text: string }[] = [];
  let score = c.weight * (c.section === "releases" ? 6 : 10);

  const outlets = c.outlets;
  if (outlets > 1) {
    const points = 12 * (outlets - 1);
    score += points;
    signals.push({ points, text: `Covered by ${outlets} outlets` });
  }
  if (c.discussion) {
    const d = c.discussion;
    const points = discussionScore(d);
    score += points;
    const text = `${plural(d.points, "point")} · ${plural(d.comments, "comment")} on ${d.site}`;
    signals.push({ points, text });
  }
  if (c.paper) {
    const points = paperScore(c.paper.upvotes);
    score += points;
    signals.push({ points, text: `${plural(c.paper.upvotes, "upvote")} on Hugging Face` });
  }

  const strong = strongMatches(`${c.title}\n${c.summary}`);
  score += Math.min(8, 2 * strong.length);

  const label = sourceLabel(c);
  if (c.section === "labs") score += 4;

  score += recencyScore(c.publishedAt, window);
  if (FUNDING.test(c.title)) score -= 6;

  const reasons = [
    ...signals.sort((a, b) => b.points - a.points).map((s) => s.text),
    label,
    matchedReason(strong.filter((m) => !m.generic).map((m) => m.text)),
  ].filter((r): r is string => r !== undefined);
  if (reasons.length === 0) reasons.push(WEIGHT_LABEL[c.weight] ?? "Useful source");

  return { score: Math.round(score * 10) / 10, reasons: reasons.slice(0, MAX_REASONS) };
}

/** Ranks every candidate in place and sorts them best first. */
export function rankAll(candidates: Candidate[], window: Window): Candidate[] {
  for (const c of candidates) Object.assign(c, rankStory(c, window));
  return candidates.sort(
    (a, b) =>
      b.score - a.score || b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id),
  );
}
