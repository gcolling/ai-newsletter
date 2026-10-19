import { site } from "../../config.ts";
import { topicById, topics } from "../../topics.ts";
import type { Issue } from "../../types.ts";
import { issuePath, monthOf, outlet, plural, weekday } from "../format.ts";
import { type Html, html } from "../html.ts";
import { href, layout } from "../layout.ts";
import { topStories } from "./issue.ts";
import { shell } from "./shell.ts";

/** The day's topic mix as a thin stacked bar: a quick read of what each issue was about. */
function mix(issue: Issue): Html {
  const total = issue.stories.length || 1;
  const parts = topics
    .map((t) => ({ t, n: issue.stories.filter((s) => s.topic === t.id).length }))
    .filter(({ n }) => n > 0);
  const label = parts.map(({ t, n }) => `${t.name} ${n}`).join(", ");
  return html`<span class="mix" role="img" aria-label="${label}">${parts.map(
    ({ t, n }) => html`<i style="--c:${t.color};flex-grow:${n / total}"></i>`,
  )}</span>`;
}

/** One day as a card, headed in the gem color of its lead story. */
function dayCard(issue: Issue): Html {
  const lead = topStories(issue)[0];
  const topic = lead ? topicById.get(lead.topic) : undefined;
  const day = issue.date.slice(8).replace(/^0/, "");
  return html`<li><a class="day-card" href="${href(issuePath(issue.date))}" style="--c:${topic?.color ?? "#0A2A8F"}">
<span class="day-card-head"><b>${day}</b><span>${weekday(issue.date)}<br>${plural(issue.stories.length, "story", "stories")}</span></span>
<span class="day-card-body">${
    lead
      ? html`<span class="day-card-kicker">${topic?.name} · ${outlet(lead.source.name)}</span><span class="day-card-title">${lead.title}</span>`
      : html`<span class="day-card-title">A quiet day</span>`
  }</span>
${mix(issue)}
</a></li>`;
}

export function archivePage(issues: Issue[]): string {
  const months = new Map<string, Issue[]>();
  for (const issue of issues) {
    const key = monthOf(issue.date);
    months.set(key, [...(months.get(key) ?? []), issue]);
  }
  const content = html`<ul class="legend">${topics.map(
    (t) => html`<li><i style="--c:${t.color}" aria-hidden="true"></i>${t.name}</li>`,
  )}</ul>
${[...months].map(
  ([month, list]) =>
    html`<section class="arch-month"><h2>${month}</h2><ol class="arch-grid">${list.map(dayCard)}</ol></section>`,
)}`;
  return layout({
    title: `Archive · ${site.name}`,
    description: `All ${issues.length} issues of ${site.name}.`,
    path: "archive/",
    body: shell(content, "archive", {
      title: "Archive",
      lede: `Every issue so far: ${plural(issues.length, "day")}. Each card takes the color of the day’s lead story, and the bar underneath shows its mix of topics.`,
      color: topicById.get("tools")?.color ?? "#035A66",
    }),
    bodyClass: "page",
  });
}
