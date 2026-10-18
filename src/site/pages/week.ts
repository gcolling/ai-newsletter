import { render, site } from "../../config.ts";
import type { Issue, Story } from "../../types.ts";
import { dayMonth, plural } from "../format.ts";
import { topMentions } from "../mentions.ts";
import { readerPage } from "./issue.ts";

const DAY_MS = 86_400_000;

const dayBefore = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);

/** Issues from the seven days ending with the latest one, newest first. */
function lastSevenDays(issues: Issue[]): Issue[] {
  const [latest] = issues;
  if (!latest) return [];
  const cutoff = dayBefore(latest.date, 6);
  return issues.filter((i) => i.date >= cutoff);
}

/** The seven days before that, for week-over-week comparisons. Empty until there is history. */
function weekBefore(issues: Issue[]): Issue[] {
  const [latest] = issues;
  if (!latest) return [];
  const from = dayBefore(latest.date, 13);
  const to = dayBefore(latest.date, 6);
  return issues.filter((i) => i.date >= from && i.date < to);
}

/**
 * Every story of the last seven issues, best first, shaped like a single issue so the reader can
 * show it ("Top stories" is the best 20). Release notes are left out: a week of version bumps is noise.
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
  }
  return { ...latest, window: { from: oldest.window.from, to: latest.window.to }, stories };
}

export function weekPage(issues: Issue[]): string | undefined {
  const week = weekIssue(issues);
  const oldest = lastSevenDays(issues).at(-1);
  const previous = weekBefore(issues);
  if (!week || !oldest) return undefined;
  const shown = Math.min(render.weekCount, week.stories.length);
  const range =
    oldest.date === week.date
      ? dayMonth(week.date)
      : `${dayMonth(oldest.date)} – ${dayMonth(week.date)}`;
  return readerPage(week, {
    kind: "week",
    heading: "This week",
    subheading: `${range} · top ${shown} of ${plural(week.stories.length, "story", "stories")}`,
    title: `This week · ${site.name}`,
    description: `The ${shown} strongest AI stories from ${range}.`,
    path: "week/",
    permalink: "week/",
    mentions: topMentions(
      week.stories,
      previous.length
        ? previous.flatMap((i) => i.stories).filter((s) => s.section !== "releases")
        : undefined,
    ),
    mentionsLabel: "Most mentioned this week",
  });
}
