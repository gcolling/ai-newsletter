import type { Candidate } from "./candidate.ts";
import { discussionScore } from "./rank.ts";
import { outletOf } from "./url.ts";

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have how i if in " +
    "into is it its just may more most new not now of on or our out over says said so than that " +
    "the their them then there these they this those to up us was we what when where which while " +
    "who why will with would you your after about all also before get gets got vs via here " +
    "one two first ai"
  ).split(" "),
);

/** Lowercased content words of a title: punctuation stripped, stopwords dropped, plurals folded. */
export function titleTokens(title: string): Set<string> {
  const tokens = title
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .split(" ")
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t !== "" && !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
  return new Set(tokens);
}

/** Crude stemming: the first five letters, so "consults" and "consulting" agree. */
function stems(title: string): Set<string> {
  return new Set([...titleTokens(title)].map((t) => t.slice(0, 5)));
}

/**
 * Same story when titles share ≥ 3 content words with Jaccard ≥ 0.5, or when the shared words cover
 * most of the shorter title (outlets pad headlines with context): ≥ 4 words and 60%, or ≥ 6 and 50%.
 */
export function similarTitles(a: string, b: string): boolean {
  const ta = stems(a);
  const tb = stems(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  const union = ta.size + tb.size - shared;
  const shorter = Math.min(ta.size, tb.size);
  if (shared >= 3 && union > 0 && shared / union >= 0.5) return true;
  const covered = shorter > 0 ? shared / shorter : 0;
  return (shared >= 4 && covered >= 0.6) || (shared >= 6 && covered >= 0.5);
}

/** Releases and papers stand on their own: "Ollama 0.40" is never the same story as a launch. */
function clusterable(c: Candidate): boolean {
  return c.section !== "releases" && c.section !== "papers";
}

/** A link shared on a forum only represents a story when no outlet covered it. */
function representativeWeight(c: Candidate): number {
  return c.section === "community" ? 0 : c.weight;
}

/** Highest source weight, then has a summary, then the tighter headline, then earliest. */
function betterRepresentative(a: Candidate, b: Candidate): number {
  return (
    representativeWeight(b) - representativeWeight(a) ||
    Number(b.summary !== "") - Number(a.summary !== "") ||
    a.title.length - b.title.length ||
    a.publishedAt.localeCompare(b.publishedAt)
  );
}

function bestDiscussion(members: Candidate[]): Candidate["discussion"] {
  let best: Candidate["discussion"];
  for (const m of members) {
    if (m.discussion && (!best || discussionScore(m.discussion) > discussionScore(best))) {
      best = m.discussion;
    }
  }
  return best;
}

function mergeGroup(members: Candidate[]): Candidate {
  const [rep, ...others] = [...members].sort(betterRepresentative);
  if (!rep) throw new Error("empty cluster");
  const discussion = bestDiscussion(members);
  if (discussion) rep.discussion = discussion;
  const seenKeys = new Set([rep.key]);
  for (const other of others) {
    if (seenKeys.has(other.key)) continue;
    seenKeys.add(other.key);
    // A community post is a link, not an outlet: credit the site it links to.
    const source = other.section === "community" ? other.host : other.source.name;
    rep.also.push({ source, title: other.title, url: other.url });
  }
  rep.outlets = countOutlets(members);
  return rep;
}

/** Distinct sites that published the story. Forum posts linking to it do not count. */
export function countOutlets(members: Candidate[]): number {
  const published = members.filter((m) => m.section !== "community");
  return Math.max(1, new Set(published.map((m) => outletOf(m.url))).size);
}

function find(parent: number[], i: number): number {
  let root = i;
  while (parent[root] !== root) root = parent[root] ?? root;
  return root;
}

/**
 * Merges candidates about the same thing: same canonical URL or near-identical titles. The best
 * source represents the story; the others move into `also`, and the liveliest discussion is kept.
 */
export function clusterStories(candidates: Candidate[]): Candidate[] {
  const parent = candidates.map((_, i) => i);
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    if (!a || !clusterable(a)) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      if (!b || !clusterable(b)) continue;
      if (a.key === b.key || similarTitles(a.title, b.title)) {
        parent[find(parent, j)] = find(parent, i);
      }
    }
  }
  const groups = new Map<number, Candidate[]>();
  candidates.forEach((c, i) => {
    const root = find(parent, i);
    groups.set(root, [...(groups.get(root) ?? []), c]);
  });
  return [...groups.values()].map(mergeGroup);
}

/**
 * Hacker News / Lobsters posts that link to a story we already have become that story's
 * discussion. Returns the posts that matched nothing; they become stories of their own.
 */
export function attachDiscussions(stories: Candidate[], posts: Candidate[]): Candidate[] {
  const byKey = new Map(stories.map((s) => [s.key, s]));
  const unmatched: Candidate[] = [];
  for (const post of posts) {
    const story = byKey.get(post.key);
    if (!story || !post.discussion) {
      unmatched.push(post);
      continue;
    }
    if (!story.discussion || discussionScore(post.discussion) > discussionScore(story.discussion)) {
      story.discussion = post.discussion;
    }
  }
  return unmatched;
}
