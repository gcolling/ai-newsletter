import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { collect, paths } from "../config.ts";
import { sources } from "../sources.ts";
import type { Issue, Section, Source, TopicId } from "../types.ts";
import { type Candidate, toStory } from "./candidate.ts";
import { feedCandidates } from "./feeds.ts";
import { hnCandidates, hnSearchUrl, parseHnHits } from "./hn.ts";
import { errorMessage, type FetchOptions, fetchJson, fetchText, mapLimit } from "./http.ts";
import { lobstersCandidates, parseLobsters } from "./lobsters.ts";
import { paperCandidates, papersUrl, parsePapers, previousWeekday } from "./papers.ts";
import { assembleStories } from "./pipeline.ts";
import type { Window } from "./rank.ts";
import {
  issueDate,
  issueWindow,
  previousIssues,
  readIssues,
  seenInHistory,
  writeIssue,
} from "./store.ts";

const FEED_CONCURRENCY = 8;
/** Lobsters answers bursts with 429. */
const LOBSTERS_GAP_MS = 3000;

interface Outcome {
  id: string;
  candidates: Candidate[];
  error?: string;
}

async function attempt(id: string, task: () => Promise<Candidate[]>): Promise<Outcome> {
  try {
    return { id, candidates: await task() };
  } catch (error) {
    return { id, candidates: [], error: errorMessage(error) };
  }
}

async function sequential(items: Source[], task: (s: Source) => Promise<Outcome>) {
  const outcomes: Outcome[] = [];
  for (const [i, item] of items.entries()) {
    if (i > 0) await sleep(LOBSTERS_GAP_MS);
    outcomes.push(await task(item));
  }
  return outcomes;
}

function hours(window: Window): number {
  return Math.round((window.to.getTime() - window.from.getTime()) / 360_000) / 10;
}

function printSummary(issue: Issue, file: string): void {
  const { sources: s, stories } = issue;
  console.log(`Issue ${issue.date}: window ${issue.window.from} → ${issue.window.to}`);
  const failed = s.failed.length > 0 ? ` · failed: ${s.failed.join(", ")}` : "";
  console.log(`Sources: ${s.ok}/${s.total} ok${failed}`);
  const perSection = new Map<Section, number>();
  for (const story of stories)
    perSection.set(story.section, (perSection.get(story.section) ?? 0) + 1);
  const sections = [...perSection].map(([section, count]) => `${section} ${count}`).join(" · ");
  console.log(`Stories: ${stories.length} (${sections})`);
  console.log("Top 10:");
  for (const story of stories.slice(0, 10)) {
    console.log(`  ${story.score.toFixed(1).padStart(5)}  ${story.title}  [${story.source.name}]`);
  }
  console.log(`Wrote ${file}`);
}

async function main(): Promise<void> {
  const now = new Date();
  const date = issueDate(now, process.env.ISSUE_DATE);
  const dir = join(paths.data, "issues");
  const warn = (message: string) => console.log(`::warning::${message}`);
  const previous = previousIssues(await readIssues(dir, warn), date);
  const window = issueWindow(previous, now, collect);
  const seen = seenInHistory(previous, date, collect.dedupeDays);
  console.log(`Collecting ${date}: ${hours(window)} h window, ${previous.length} earlier issues`);

  const http: FetchOptions = {
    userAgent: collect.userAgent,
    timeoutMs: collect.timeoutMs,
    retries: collect.retries,
  };
  const context = { window, now, summaryLength: collect.summaryLength };
  const feedSources = sources.filter((s) => s.format !== "json");
  const jsonSources = sources.filter((s) => s.format === "json");
  const papersDay = previousWeekday(new Date(`${date}T00:00:00Z`));

  const [feeds, hn, papers, lobsters] = await Promise.all([
    mapLimit(feedSources, FEED_CONCURRENCY, (source) =>
      attempt(source.id, async () =>
        feedCandidates(source, await fetchText(source.feed, http), context),
      ),
    ),
    attempt("hacker-news", async () =>
      hnCandidates(parseHnHits(await fetchJson(hnSearchUrl(window), http)), window),
    ),
    attempt("hf-papers", async () =>
      paperCandidates(
        parsePapers(await fetchJson(papersUrl(papersDay), http)),
        papersDay,
        collect.summaryLength,
      ),
    ),
    sequential(jsonSources, (source) =>
      attempt(source.id, async () =>
        lobstersCandidates(
          parseLobsters(await fetchJson(source.feed, http)),
          source,
          window,
          collect.summaryLength,
        ),
      ),
    ),
  ]);

  const outcomes = [...feeds, hn, papers, ...lobsters];
  const failed = outcomes.filter((o) => o.error !== undefined);
  for (const f of failed) console.log(`::warning::Source ${f.id} failed: ${f.error}`);
  if (failed.length > outcomes.length / 2) {
    // Writing a near-empty issue would also move the next window past the stories we missed.
    console.log(`::error::${failed.length} of ${outcomes.length} sources failed; no issue written`);
    process.exitCode = 1;
    return;
  }

  const ok = new Set(outcomes.filter((o) => o.error === undefined).map((o) => o.id));
  const pinnedTopics = new Map<string, TopicId>();
  for (const s of sources) if (s.topic) pinnedTopics.set(s.id, s.topic);
  const stories = assembleStories({
    feeds: feedSources
      .map((source, i) => ({ source, candidates: feeds[i]?.candidates ?? [] }))
      .filter(({ source }) => ok.has(source.id)),
    community: [hn.candidates, ...lobsters.map((o) => o.candidates)],
    papers: papers.candidates,
    seen,
    window,
    pinnedTopics,
  });

  const issue: Issue = {
    version: 1,
    date,
    generatedAt: new Date().toISOString(),
    window: { from: window.from.toISOString(), to: window.to.toISOString() },
    sources: {
      total: outcomes.length,
      ok: outcomes.length - failed.length,
      failed: failed.map((f) => f.id),
    },
    stories: stories.map(toStory),
  };
  printSummary(issue, await writeIssue(dir, issue));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
