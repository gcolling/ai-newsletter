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
import { glyph } from "../glyphs.ts";
import { type Html, html, safeUrl } from "../html.ts";
import { href, layout } from "../layout.ts";
import { type Mention, termsOf, topMentions } from "../mentions.ts";
import { type Place, topbar } from "./shell.ts";

interface Neighbours {
  newer?: Issue;
  older?: Issue;
}

/** Everything that differs between a day's issue and the week's best. */
export interface ReaderOptions {
  kind: "day" | "week";
  /** Which top-bar link to mark as current. */
  place: Place;
  heading: string;
  subheading: string;
  title: string;
  description: string;
  /** Site-relative path of the page. */
  path: string;
  /** Stable address of this page, used for links to a single story. */
  permalink: string;
  near?: Neighbours;
  /** Terms shown above the list; clicking one filters by it. */
  mentions: Mention[];
  mentionsLabel: string;
}

/** Stories that open the day: best first, no release notes, and papers can't crowd out the news. */
export function topStories(issue: Issue, count = render.topCount): Story[] {
  const top: Story[] = [];
  let papers = 0;
  for (const story of issue.stories) {
    if (top.length === count) break;
    if (story.section === "releases") continue;
    if (story.section === "papers" && ++papers > render.maxTopPapers) continue;
    top.push(story);
  }
  return top;
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
  return html`<li class="row" id="r-${story.id}" data-id="${story.id}" data-topic="${story.topic}" data-views="${viewsOf(story, top)}" data-terms="${termsOf(story).join("|")}" style="--c:${colorOf(story)}">
<a class="row-link" href="${safeUrl(story.url)}" rel="noopener noreferrer">
<span class="dot" aria-hidden="true"></span>
<span class="row-src">${outlet(story.source.name)} · ${topicName(story)}</span>
<span class="row-title">${story.title}</span>
<span class="row-meta"><time datetime="${story.publishedAt}">${stamp(story.publishedAt)}</time>${extra ? ` · ${extra}` : ""}</span>
</a>
<button class="row-save" type="button" data-row-save aria-pressed="false" aria-label="Save story" title="Save for later (S)">${glyph("bookmark")}</button>
</li>`;
}

function mentionsStrip(mentions: Mention[], label: string): Html | "" {
  if (mentions.length === 0) return "";
  const delta = (m: Mention) => {
    if (m.previous === undefined) return "";
    const d = m.count - m.previous;
    if (m.previous === 0) return html` <span class="delta up">new</span>`;
    return d === 0
      ? ""
      : html` <span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${Math.abs(d)}</span>`;
  };
  return html`<section class="mentions" aria-label="${label}"><h3>${label}</h3><div class="mention-chips">${mentions.map(
    (m) =>
      html`<button type="button" class="mention" data-term="${m.term}" aria-pressed="false">${m.term} <b>${m.count}</b>${delta(m)}</button>`,
  )}</div></section>`;
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
<button class="btn ghost" type="button" data-save aria-pressed="false">Save</button>
<button class="btn ghost" type="button" data-share>Share</button>
${discussionLink(story)}
<button class="btn ghost next" type="button" data-next>Next <span aria-hidden="true">→</span></button>
</div>
</div>
</article>`;
}

function viewLink(id: string, label: string, count: number, color?: string): Html {
  return html`<a class="view" href="#${id}" data-view="${id}"${color ? html` data-topic="${id}"` : ""}>${color ? html`<i style="--c:${color}" aria-hidden="true"></i>` : ""}<span>${label}</span><em>${count}</em></a>`;
}

function rail(issue: Issue, top: Story[], opts: ReaderOptions): Html {
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
  const { near } = opts;
  const { ok, total } = issue.sources;
  const arrow = (issue: Issue | undefined, rel: "prev" | "next") => {
    const glyph = rel === "prev" ? "‹" : "›";
    if (!issue) return html`<span class="day-arrow off" aria-hidden="true">${glyph}</span>`;
    const label = `${rel === "prev" ? "Previous" : "Next"} issue: ${shortDay(issue.date)}`;
    return html`<a class="day-arrow" href="${href(issuePath(issue.date))}" rel="${rel}" aria-label="${label}" title="${label}">${glyph}</a>`;
  };
  const days =
    opts.kind === "day"
      ? html`<nav class="day-nav" aria-label="Other issues">${arrow(near?.older, "prev")}${arrow(near?.newer, "next")}</nav>`
      : "";
  return html`<aside class="rail">
<header class="day">
<div class="day-row"><h1 class="day-name">${opts.heading}</h1>${days}</div>
<p class="day-date">${opts.subheading}</p>
<p class="day-status"><a href="${href("about/#sources")}" title="Ranked by rules, not a model">Built ${timeUtc(issue.generatedAt)} · ${ok} of ${total} sources</a></p>
<p class="offline" data-offline hidden>You’re offline. This is the last copy you opened.</p>
</header>
<nav class="views" aria-label="Filter stories">
${viewLink("top", "Top stories", top.length)}
${viewLink("all", "Everything", issue.stories.length)}
<p class="group"><span>Topics</span><button class="group-edit" type="button" data-edit-topics aria-pressed="false">Edit</button></p>
<p class="edit-hint" hidden>Click a topic to pin it to Top stories, again to mute it, again to reset.</p>
${topicLinks}
<hr>
${kinds.filter(([, , n]) => n > 0).map(([id, label, n]) => viewLink(id, label, n))}
${viewLink("watching", "Watching", 0)}
</nav>
<label class="watch-edit" data-watch-edit hidden><span>Watch words</span><input type="text" data-watch-input placeholder="MCP, Temporal, Playwright" autocomplete="off" spellcheck="false"><small>Comma-separated. Matching stories are marked and collected under Watching.</small></label>
</aside>`;
}

export function readerPage(issue: Issue, opts: ReaderOptions): string {
  const top = topStories(issue, opts.kind === "week" ? render.weekCount : render.topCount);
  const topIds = new Set(top.map((s) => s.id));
  const unit = opts.kind === "week" ? "week" : "day";
  const body = html`${topbar(opts.place)}
<div class="app" data-date="${issue.date}" data-permalink="${href(opts.permalink)}">
${rail(issue, top, opts)}
<div class="splitter" data-split="rail" role="separator" aria-orientation="vertical" aria-label="Resize the topics column" tabindex="0"></div>
<section class="list" aria-labelledby="view-title">
<header class="list-head"><h2 id="view-title">Top stories</h2><span data-view-meta>${top.length} · ${readingTime(top.length)}</span></header>
${mentionsStrip(opts.mentions, opts.mentionsLabel)}
<label class="search"><span class="sr-only">Search stories</span><input type="search" data-search placeholder="${opts.kind === "week" ? "Search this week" : "Search today’s stories"}" autocomplete="off" spellcheck="false"><kbd aria-hidden="true">/</kbd></label>
<div class="list-tools"><button class="tool" type="button" data-hide-read aria-pressed="false">Hide read</button><button class="tool" type="button" data-mark-all>Mark all read</button></div>
<ol class="rows">
${issue.stories.map((s) => row(s, topIds))}
</ol>
<p class="list-empty" data-empty hidden>Nothing here.</p>
</section>
<div class="splitter" data-split="list" role="separator" aria-orientation="vertical" aria-label="Resize the story list" tabindex="0"></div>
<main class="stage" aria-label="Story">
<div class="stage-card">
<div class="stage-bar">
<span class="pos" data-pos aria-live="polite"></span>
<button class="pill" type="button" data-focus aria-pressed="false">Focus</button>
<div class="ticks" data-ticks aria-hidden="true"></div>
</div>
${issue.stories.map(card)}
<section class="story end" data-end aria-label="End of view">
<div class="story-body">
<h2 class="story-title">That’s the ${unit}.</h2>
<p class="summary">You’ve reached the end of this view. Pick another on the left, browse <a href="${href("archive/")}">past issues</a>, or come back tomorrow morning.</p>
</div>
</section>
</div>
<section class="up-next" data-up-next aria-label="Up next" hidden>
<h3>Up next <span class="keys" aria-hidden="true"><kbd>J</kbd> <kbd>K</kbd> move · <kbd>S</kbd> save · <kbd>F</kbd> focus · <kbd>/</kbd> search</span></h3>
<div class="up-next-cards" data-up-next-cards></div>
</section>
</main>
</div>`;
  return layout({
    title: opts.title,
    description: opts.description,
    path: opts.path,
    body,
    bodyClass: "reader",
  });
}

export function issuePage(issue: Issue, near: Neighbours, isLatest: boolean): string {
  const lead = topStories(issue)[0] ?? issue.stories[0];
  const day = `${weekday(issue.date)} ${dayMonth(issue.date)}`;
  return readerPage(issue, {
    kind: "day",
    place: isLatest ? "today" : "",
    heading: weekday(issue.date),
    subheading: `${dayMonth(issue.date)} · ${plural(issue.stories.length, "story", "stories")}`,
    title: isLatest ? `${site.name} · ${day}` : `${day} · ${site.name}`,
    description: lead
      ? `${plural(issue.stories.length, "story", "stories")} today. Leading: ${lead.title}`
      : site.tagline,
    path: isLatest ? "" : issuePath(issue.date),
    permalink: issuePath(issue.date),
    near,
    mentions: topMentions(issue.stories, undefined, 6),
    mentionsLabel: "Most mentioned today",
  });
}
