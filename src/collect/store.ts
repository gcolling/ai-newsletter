import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Issue } from "../types.ts";
import type { Candidate } from "./candidate.ts";
import type { Window } from "./rank.ts";
import { canonicalUrl } from "./url.ts";

const ISSUE_FILE = /^(\d{4}-\d{2}-\d{2})\.json$/;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

export interface WindowSettings {
  firstWindowHours: number;
  maxWindowHours: number;
}

/** What earlier issues already published; matching stories are not repeated. */
export interface Seen {
  ids: Set<string>;
  urls: Set<string>;
  discussions: Set<string>;
}

/** UTC date of the run, or ISSUE_DATE when set (local testing only). */
export function issueDate(now: Date, override?: string): string {
  if (!override) return now.toISOString().slice(0, 10);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(override) && !Number.isNaN(Date.parse(override));
  if (!valid) throw new Error(`ISSUE_DATE must be YYYY-MM-DD, got "${override}"`);
  return override;
}

function looksLikeIssue(value: unknown): value is Issue {
  const issue = value as Partial<Issue> | null;
  return (
    typeof issue?.date === "string" &&
    typeof issue.window?.to === "string" &&
    Array.isArray(issue.stories)
  );
}

/** Every readable issue in `dir`, newest first. Unreadable files are reported and skipped. */
export async function readIssues(dir: string, warn: (message: string) => void): Promise<Issue[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const issues: Issue[] = [];
  for (const name of names.filter((n) => ISSUE_FILE.test(n))) {
    try {
      const parsed: unknown = JSON.parse(await readFile(join(dir, name), "utf8"));
      if (looksLikeIssue(parsed)) issues.push(parsed);
      else warn(`${name} is not an issue file; ignored`);
    } catch (error) {
      warn(`${name} could not be read (${(error as Error).message}); ignored`);
    }
  }
  return issues.sort((a, b) => b.date.localeCompare(a.date));
}

/** Issues before `today`. Today's own file is ignored because a re-run replaces it. */
export function previousIssues(issues: Issue[], today: string): Issue[] {
  return issues.filter((issue) => issue.date < today);
}

/**
 * Continue where the latest issue stopped, but never reach back more than `maxWindowHours`.
 * Without history, look back `firstWindowHours`.
 */
export function issueWindow(previous: Issue[], now: Date, settings: WindowSettings): Window {
  const to = now;
  const fallback = new Date(now.getTime() - settings.firstWindowHours * HOUR);
  const floor = new Date(now.getTime() - settings.maxWindowHours * HOUR);
  const latest = previous[0];
  let from = latest ? new Date(latest.window.to) : fallback;
  if (Number.isNaN(from.getTime()) || from >= to) from = fallback;
  if (from < floor) from = floor;
  return { from, to };
}

export function seenInHistory(previous: Issue[], today: string, days: number): Seen {
  const oldest = new Date(Date.parse(today) - days * DAY).toISOString().slice(0, 10);
  const seen: Seen = { ids: new Set(), urls: new Set(), discussions: new Set() };
  for (const issue of previous.filter((i) => i.date >= oldest)) {
    for (const story of issue.stories) {
      seen.ids.add(story.id);
      seen.urls.add(canonicalUrl(story.url));
      for (const other of story.also ?? []) seen.urls.add(canonicalUrl(other.url));
      if (story.discussion) seen.discussions.add(story.discussion.url);
    }
  }
  return seen;
}

export function isSeen(c: Candidate, seen: Seen): boolean {
  return (
    seen.ids.has(c.id) ||
    seen.urls.has(c.key) ||
    (c.discussion !== undefined && seen.discussions.has(c.discussion.url))
  );
}

/** Pretty JSON, written to a temp file first so a crash never leaves half an issue behind. */
export async function writeIssue(dir: string, issue: Issue): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${issue.date}.json`);
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(issue, null, 2)}\n`, "utf8");
  await rename(temp, file);
  return file;
}
