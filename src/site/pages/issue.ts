import { render, site } from "../../config.ts";
import { topicById, topics } from "../../topics.ts";
import type { Issue, Story } from "../../types.ts";
import {
  dayMonth,
  destination,
  issuePath,
  outlet,
  plural,
  readingTime,
  shortDay,
  stamp,
  timeUtc,
  weekday,
} from "../format.ts";
import { type Html, html, safeUrl } from "../html.ts";
import { href, layout } from "../layout.ts";

interface Neighbours {
  newer?: Issue;
  older?: Issue;
}

/** Stories that can open the day: everything except release notes. */
export function topStories(issue: Issue): Story[] {
  return issue.stories.filter((s) => s.section !== "releases").slice(0, render.topCount);
}

/** Every view a story belongs to, as a space-separated token list for the client. */
function viewsOf(story: Story, top: Set<string>): string {
  const views = ["all", story.topic];
  if (top.has(story.id)) views.push("top");
  if (story.section === "releases") views.push("releases");
  if (story.section === "papers") views.push("papers");
  if (story.discussion) views.push("discussed");
  return views.join(" ");
}

const colorOf = (story: Story) => topicById.get(story.topic)?.color ?? "#0A2A8F";
const topicName = (story: Story) => topicById.get(story.topic)?.name ?? "";

function signal(story: Story): string {
  if (story.discussion) return `▲ ${story.discussion.points}`;
  if (story.paper) return `▲ ${story.paper.upvotes}`;
  if (story.also.length) return `${story.also.length + 1} outlets`;
  return "";
}

function row(story: Story, top: Set<string>): Html {
  const extra = signal(story);
  return html`<li class="row" id="r-${story.id}" data-id="${story.id}" data-views="${viewsOf(story, top)}" style="--c:${colorOf(story)}">
<a class="row-link" href="${safeUrl(story.url)}" rel="noopener noreferrer">
<span class="dot" aria-hidden="true"></span>
<span class="row-src">${outlet(story.source.name)} · ${topicName(story)}</span>
<span class="row-title">${story.title}</span>
<span class="row-meta"><time datetime="${story.publishedAt}">${stamp(story.publishedAt)}</time>${extra ? ` · ${extra}` : ""}</span>
</a>
</li>`;
}

function discussionLink(story: Story): Html | "" {
  const d = story.discussion;
  if (!d) return "";
  return html`<a class="btn ghost" href="${safeUrl(d.url)}" target="_blank" rel="noopener noreferrer">${plural(d.comments, "comment")} on ${d.site}</a>`;
}

function card(story: Story): Html {
  const summary = story.summary
    ? html`<p class="summary">${story.summary}</p>`
    : html`<p class="summary host">${story.host}</p>`;
  const why = story.reasons.length
    ? html`<section class="why"><h3>Why it’s here</h3><ul class="chips">${story.reasons.map((r) => html`<li>${r}</li>`)}</ul></section>`
    : "";
  const also = story.also.length
    ? html`<section class="also"><h3>Also covered by</h3><ul>${story.also.map(
        (a) =>
          html`<li><a href="${safeUrl(a.url)}" target="_blank" rel="noopener noreferrer"><b>${outlet(a.source)}</b> <span>${a.title}</span></a></li>`,
      )}</ul></section>`
    : "";
  return html`<article class="story" id="s-${story.id}" data-id="${story.id}" style="--c:${colorOf(story)}" aria-labelledby="t-${story.id}">
<p class="kicker"><b>${topicName(story)}</b> · ${outlet(story.source.name)} · <time datetime="${story.publishedAt}">${stamp(story.publishedAt)}</time></p>
<div class="story-body">
<h2 class="story-title" id="t-${story.id}"><a href="${safeUrl(story.url)}" target="_blank" rel="noopener noreferrer">${story.title}</a></h2>
${summary}
<div class="meta">${why}${also}</div>
<div class="actions">
<a class="btn go" href="${safeUrl(story.url)}" target="_blank" rel="noopener noreferrer" data-open>Read at ${destination(story)} <span aria-hidden="true">↗</span></a>
${discussionLink(story)}
<button class="btn ghost" type="button" data-next>Next story</button>
<span class="keys" aria-hidden="true"><kbd>J</kbd><kbd>K</kbd> move · <kbd>F</kbd> focus</span>
</div>
</div>
</article>`;
}

function viewLink(id: string, label: Html | string, count: number, color?: string): Html {
  return html`<a class="view" href="#${id}" data-view="${id}">${color ? html`<i style="--c:${color}" aria-hidden="true"></i>` : ""}<span>${label}</span><em>${count}</em></a>`;
}

function rail(issue: Issue, top: Story[], near: Neighbours): Html {
  const count = (pred: (s: Story) => boolean) => issue.stories.filter(pred).length;
  const topicLinks = topics
    .map((t) => ({ t, n: count((s) => s.topic === t.id) }))
    .filter(({ n }) => n > 0)
    .map(({ t, n }) => viewLink(t.id, t.name, n, t.color));
  const kinds = [
    ["releases", "Releases", count((s) => s.section === "releases")],
    ["papers", "Papers", count((s) => s.section === "papers")],
    ["discussed", "Discussed", count((s) => Boolean(s.discussion))],
  ] as const;
  const { ok, total } = issue.sources;
  return html`<aside class="rail">
<header class="day">
<a class="brand" href="${href()}">${site.name}</a>
<h1 class="day-name">${weekday(issue.date)}</h1>
<p class="day-date">${dayMonth(issue.date)} · ${plural(issue.stories.length, "story", "stories")}</p>
</header>
<nav class="views" aria-label="Filter stories">
${viewLink("top", "Top stories", top.length)}
${viewLink("all", "Everything", issue.stories.length)}
<p class="group">Topics</p>
${topicLinks}
<hr>
${kinds.filter(([, , n]) => n > 0).map(([id, label, n]) => viewLink(id, label, n))}
</nav>
<footer class="rail-foot">
<nav class="days" aria-label="Other issues">
${near.older ? html`<a href="${href(issuePath(near.older.date))}" rel="prev">‹ ${shortDay(near.older.date)}</a>` : html`<span></span>`}
<a href="${href("archive/")}">Archive</a>
${near.newer ? html`<a href="${href(issuePath(near.newer.date))}" rel="next">${shortDay(near.newer.date)} ›</a>` : html`<span></span>`}
</nav>
<p>Built ${timeUtc(issue.generatedAt)} from ${ok} of ${total} sources. <a href="${href("about/")}">Ranked by rules, not a model.</a> <a href="${href("feed.xml")}">RSS</a></p>
</footer>
</aside>`;
}

export function issuePage(issue: Issue, near: Neighbours, isLatest: boolean): string {
  const top = topStories(issue);
  const topIds = new Set(top.map((s) => s.id));
  const lead = top[0] ?? issue.stories[0];
  const body = html`<div class="app" data-date="${issue.date}">
${rail(issue, top, near)}
<section class="list" aria-labelledby="view-title">
<header class="list-head"><h2 id="view-title">Top stories</h2><span data-view-meta>${top.length} · ${readingTime(top.length)}</span></header>
<ol class="rows">
${issue.stories.map((s) => row(s, topIds))}
</ol>
<p class="list-empty" hidden>Nothing here today.</p>
</section>
<main class="stage" aria-label="Story">
<div class="stage-bar">
<span class="pos" data-pos aria-live="polite"></span>
<button class="pill" type="button" data-focus aria-pressed="false">Focus</button>
<div class="ticks" data-ticks aria-hidden="true"></div>
</div>
${issue.stories.map(card)}
<section class="story end" data-end aria-label="End of view">
<div class="story-body">
<h2 class="story-title">That’s the day.</h2>
<p class="summary">You’ve reached the end of this view. Pick another on the left, browse <a href="${href("archive/")}">past issues</a>, or come back tomorrow morning.</p>
</div>
</section>
</main>
</div>`;
  const title = isLatest
    ? `${site.name} · ${weekday(issue.date)} ${dayMonth(issue.date)}`
    : `${weekday(issue.date)} ${dayMonth(issue.date)} · ${site.name}`;
  const description = lead
    ? `${plural(issue.stories.length, "story", "stories")} today. Leading: ${lead.title}`
    : site.tagline;
  return layout({
    title,
    description,
    path: isLatest ? "" : issuePath(issue.date),
    body,
    bodyClass: "reader",
  });
}
