import { render, site } from "../../config.ts";
import type { Issue, Story } from "../../types.ts";
import { dayMonth, plural } from "../format.ts";
import { readerPage } from "./issue.ts";

const DAY_MS = 86_400_000;

/** Issues from the seven days ending with the latest one, newest first. */
function lastSevenDays(issues: Issue[]): Issue[] {
  const [latest] = issues;
  if (!latest) return [];
  const cutoff = new Date(Date.parse(`${latest.date}T00:00:00Z`) - 6 * DAY_MS)
    .toISOString()
    .slice(0, 10);
  return issues.filter((i) => i.date >= cutoff);
}

/**
 * The strongest stories of the last seven issues, shaped like a single issue so the reader can show
 * it. Release notes are left out: a week of version bumps is noise.
 */
export function weekIssue(issues: Issue[]): Issue | undefined {
  const recent = lastSevenDays(issues);
  const [latest] = recent;
  const oldest = recent.at(-1);
  if (!latest || !oldest) return undefined;
  const seen = new Set<string>();
  const stories: Story[] = [];
  for (const story of recent.flatMap((i) => i.stories).sort((a, b) => b.score - a.score)) {
    if (story.section === "releases" || seen.has(story.id)) continue;
    seen.add(story.id);
    stories.push(story);
    if (stories.length === render.weekCount) break;
  }
  return { ...latest, window: { from: oldest.window.from, to: latest.window.to }, stories };
}

export function weekPage(issues: Issue[]): string | undefined {
  const week = weekIssue(issues);
  const oldest = lastSevenDays(issues).at(-1);
  if (!week || !oldest) return undefined;
  const range =
    oldest.date === week.date
      ? dayMonth(week.date)
      : `${dayMonth(oldest.date)} – ${dayMonth(week.date)}`;
  return readerPage(week, {
    kind: "week",
    heading: "This week",
    subheading: `${range} · ${plural(week.stories.length, "story", "stories")}`,
    title: `This week · ${site.name}`,
    description: `The ${week.stories.length} strongest AI stories from ${range}.`,
    path: "week/",
  });
}
