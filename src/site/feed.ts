import { site } from "../config.ts";
import type { Issue } from "../types.ts";
import { destination, issuePath, longDate, outlet, plural } from "./format.ts";
import { html, safeUrl } from "./html.ts";
import { absolute } from "./layout.ts";
import { topStories } from "./pages/issue.ts";

const FEED_LENGTH = 30;

/** One entry per issue, carrying the top stories, so any feed reader works as a daily inbox. */
function entryContent(issue: Issue): string {
  const top = topStories(issue);
  const more = issue.stories.length - top.length;
  return html`<ol>${top.map(
    (s) =>
      html`<li><p><a href="${safeUrl(s.url)}"><strong>${s.title}</strong></a><br>${outlet(s.source.name)}${s.reasons[0] ? ` · ${s.reasons[0]}` : ""}</p>${s.summary ? html`<p>${s.summary}</p>` : ""}<p><a href="${safeUrl(s.url)}">Read at ${destination(s)}</a></p></li>`,
  )}</ol>${more > 0 ? html`<p><a href="${absolute(issuePath(issue.date))}">${plural(more, "more story", "more stories")} in the full issue</a></p>` : ""}`
    .value;
}

export function atomFeed(issues: Issue[]): string {
  const latest = issues[0];
  const entries = issues.slice(0, FEED_LENGTH).map((issue) => {
    const url = absolute(issuePath(issue.date));
    return html`<entry>
<id>${url}</id>
<title>${longDate(issue.date)}: ${plural(issue.stories.length, "story", "stories")}</title>
<link rel="alternate" type="text/html" href="${url}"/>
<published>${issue.generatedAt}</published>
<updated>${issue.generatedAt}</updated>
<content type="html">${entryContent(issue)}</content>
</entry>`;
  });
  return html`<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<id>${absolute()}</id>
<title>${site.name}</title>
<subtitle>${site.tagline}</subtitle>
<link rel="alternate" type="text/html" href="${absolute()}"/>
<link rel="self" type="application/atom+xml" href="${absolute("feed.xml")}"/>
<updated>${latest?.generatedAt ?? new Date(0).toISOString()}</updated>
<author><name>${site.name}</name></author>
${entries}
</feed>
`.value;
}
