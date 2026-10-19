import { site } from "../config.ts";
import { topics } from "../topics.ts";
import type { Issue, Story } from "../types.ts";
import { destination, outlet } from "./format.ts";
import { html, safeUrl } from "./html.ts";
import { absolute } from "./layout.ts";
import { topStories } from "./pages/issue.ts";

/** Days of issues a story feed reaches back, and the most entries it carries. */
const DAYS = 14;
const MAX_ENTRIES = 100;

export interface StoryFeed {
  /** Site-relative path, e.g. "feeds/agents.xml". */
  path: string;
  title: string;
  description: string;
}

/** Each story as its own entry, so a feed reader or an automation tool sees one item per story. */
function entry(story: Story, issue: Issue): string {
  const topic = topics.find((t) => t.id === story.topic)?.name ?? "";
  const d = story.discussion;
  const content = html`${story.summary ? html`<p>${story.summary}</p>` : ""}${
    story.reasons.length ? html`<p>Why it’s here: ${story.reasons.join(" · ")}</p>` : ""
  }<p><a href="${safeUrl(story.url)}">Read at ${destination(story)}</a>${
    d ? html` · <a href="${safeUrl(d.url)}">${d.comments} comments on ${d.site}</a>` : ""
  }</p>`.value;
  return html`<entry>
<id>tag:${new URL(site.url).hostname},${issue.date}:${story.id}</id>
<title>${story.title}</title>
<link rel="alternate" type="text/html" href="${safeUrl(story.url)}"/>
<published>${story.publishedAt}</published>
<updated>${issue.generatedAt}</updated>
<author><name>${outlet(story.source.name)}</name></author>
<category term="${story.topic}" label="${topic}"/>
<content type="html">${content}</content>
</entry>`.value;
}

function storyFeed(feed: StoryFeed, picks: { story: Story; issue: Issue }[], updated: string) {
  return html`<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<id>${absolute(feed.path)}</id>
<title>${feed.title}</title>
<subtitle>${feed.description}</subtitle>
<link rel="alternate" type="text/html" href="${absolute()}"/>
<link rel="self" type="application/atom+xml" href="${absolute(feed.path)}"/>
<updated>${updated}</updated>
<author><name>${site.name}</name></author>
`.value
    .concat(
      picks
        .slice(0, MAX_ENTRIES)
        .map(({ story, issue }) => entry(story, issue))
        .join("\n"),
    )
    .concat("\n</feed>\n");
}

/** Every story feed the site publishes: today's top stories, then one per topic. */
export function storyFeeds(issues: Issue[]): (StoryFeed & { xml: string })[] {
  const recent = issues.slice(0, DAYS);
  const updated = recent[0]?.generatedAt ?? new Date(0).toISOString();
  const all = recent.flatMap((issue) => issue.stories.map((story) => ({ story, issue })));
  const top = recent.flatMap((issue) => topStories(issue).map((story) => ({ story, issue })));
  const feeds = [
    {
      path: "feeds/top.xml",
      title: `${site.name}: top stories`,
      description: "Each day’s top stories, one entry per story.",
      picks: top,
    },
    ...topics.map((t) => ({
      path: `feeds/${t.id}.xml`,
      title: `${site.name}: ${t.name}`,
      description: `Every ${t.name} story, one entry per story.`,
      picks: all.filter(({ story }) => story.topic === t.id),
    })),
  ];
  return feeds.map(({ picks, ...feed }) => ({ ...feed, xml: storyFeed(feed, picks, updated) }));
}
