import { site } from "../../config.ts";
import { topicById, topics } from "../../topics.ts";
import type { Issue } from "../../types.ts";
import { issuePath, monthOf, plural, weekday } from "../format.ts";
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

function entry(issue: Issue): Html {
  const lead = topStories(issue)[0];
  const day = issue.date.slice(8).replace(/^0/, "");
  return html`<li><a class="arch-row" href="${href(issuePath(issue.date))}">
<span class="arch-day"><b>${day}</b> ${weekday(issue.date).slice(0, 3)}</span>
<span class="arch-lead">${lead ? html`<i style="--c:${topicById.get(lead.topic)?.color}" aria-hidden="true"></i>${lead.title}` : "Quiet day"}</span>
<span class="arch-n">${plural(issue.stories.length, "story", "stories")}</span>
${mix(issue)}
</a></li>`;
}

export function archivePage(issues: Issue[]): string {
  const months = new Map<string, Issue[]>();
  for (const issue of issues) {
    const key = monthOf(issue.date);
    months.set(key, [...(months.get(key) ?? []), issue]);
  }
  const content = html`<h1 class="doc-title">Archive</h1>
<p class="doc-lede">Every issue so far. The bar under each day shows its mix of topics.</p>
<ul class="legend">${topics.map((t) => html`<li><i style="--c:${t.color}" aria-hidden="true"></i>${t.name}</li>`)}</ul>
${[...months].map(
  ([month, list]) =>
    html`<section class="arch-month"><h2>${month}</h2><ol class="arch">${list.map(entry)}</ol></section>`,
)}`;
  return layout({
    title: `Archive · ${site.name}`,
    description: `All ${issues.length} issues of ${site.name}.`,
    path: "archive/",
    body: shell(content, "archive"),
    bodyClass: "page",
  });
}
