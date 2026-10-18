import { site } from "../../config.ts";
import { sources } from "../../sources.ts";
import { topics } from "../../topics.ts";
import type { Section, Source } from "../../types.ts";
import { outlet } from "../format.ts";
import { type Html, html, safeUrl } from "../html.ts";
import { href, layout } from "../layout.ts";
import { shell } from "./shell.ts";

const sectionNames: [Section, string][] = [
  ["labs", "Labs and platforms"],
  ["news", "Tech press"],
  ["essays", "Practitioners"],
  ["automation", "Automation and integrations"],
  ["releases", "Release notes"],
  ["community", "Community"],
];

const weightLabel = ["", "useful", "solid", "must-read"];

function sourceItem(s: Pick<Source, "name" | "homepage" | "weight" | "mirror">): Html {
  return html`<li><a href="${safeUrl(s.homepage)}">${outlet(s.name)}</a><span class="weight" title="Weight ${s.weight} of 3: ${weightLabel[s.weight]}">${"●".repeat(s.weight)}${"○".repeat(3 - s.weight)}</span>${s.mirror ? html`<span class="tag">mirror</span>` : ""}</li>`;
}

const apiSources: Pick<Source, "name" | "homepage" | "weight" | "section">[] = [
  {
    name: "Hacker News",
    homepage: "https://news.ycombinator.com/",
    weight: 2,
    section: "community",
  },
  {
    name: "Hugging Face Papers",
    homepage: "https://huggingface.co/papers",
    weight: 2,
    section: "community",
  },
];

export function aboutPage(): string {
  const total = sources.length + apiSources.length;
  const content = html`<h1 class="doc-title">How it works</h1>
<p class="doc-lede">Every morning, around 05:30 UTC, a script reads ${total} sources, keeps what is about AI, automation and integrations, and ranks it with plain rules you can read below. No language model picks, writes or summarises anything here.</p>

<section class="steps">
<div><h2>Read</h2><p>Official lab blogs, the tech press, practitioners’ newsletters, release notes from tools engineers use, Hacker News and Lobsters discussions, and the day’s most upvoted papers on Hugging Face.</p></div>
<div><h2>Filter</h2><p>General feeds only get through when they match AI vocabulary: an LLM, an agent, MCP and so on. Deals, listicles and gaming news are dropped. Anything shown in the last seven days doesn’t come back.</p></div>
<div><h2>Group</h2><p>When several outlets cover the same story, they fold into one card. The others are listed under “Also covered by”.</p></div>
<div><h2>Rank</h2><p>Each story earns points from the signals below. The card shows which ones put it there, under “Why it’s here”.</p></div>
</section>

<table class="rules">
<caption>Ranking signals</caption>
<tbody>
<tr><th scope="row">Source weight</th><td>10, 20 or 30 points for useful, solid and must-read sources</td></tr>
<tr><th scope="row">Coverage</th><td>+12 for every other outlet reporting the same story</td></tr>
<tr><th scope="row">Discussion</th><td>Hacker News and Lobsters points and comments, on a log scale</td></tr>
<tr><th scope="row">Papers</th><td>Hugging Face upvotes, on a log scale</td></tr>
<tr><th scope="row">Relevance</th><td>Up to +8 for strong AI terms in the title and summary</td></tr>
<tr><th scope="row">Official</th><td>+4 for announcements straight from a lab</td></tr>
<tr><th scope="row">Freshness</th><td>Up to +6 for the newest stories</td></tr>
<tr><th scope="row">Funding rounds</th><td>−6, because “raises $40M” is rarely news for engineers</td></tr>
</tbody>
</table>

<h2 class="doc-h2">Topics</h2>
<p>Each story gets one topic from keywords in its title and summary. Colors are gem cuts, so they stay readable with white text.</p>
<ul class="gems">${topics.map((t) => html`<li style="--c:${t.color}"><b>${t.name}</b><span>${t.gem}</span></li>`)}</ul>

<h2 class="doc-h2">Sources</h2>
<p>Dots show weight. Mirrors are community-run copies of sites without a feed, from <a href="https://github.com/Olshansk/rss-feeds">Olshansk/rss-feeds</a>.</p>
<div class="source-groups">
${sectionNames.map(([id, name]) => {
  const list = [...sources, ...apiSources].filter((s) => s.section === id);
  return html`<section><h3>${name} <em>${list.length}</em></h3><ul class="sources">${list.map(sourceItem)}</ul></section>`;
})}
</div>

<h2 class="doc-h2">Feeds</h2>
<p>Subscribe in any feed reader, or pipe a topic into Slack, email or an n8n or Zapier workflow with their RSS triggers.</p>
<ul class="feeds">
<li><a href="${href("feed.xml")}">Daily issue</a><span>One entry per day with the top stories</span></li>
<li><a href="${href("feeds/top.xml")}">Top stories</a><span>One entry per story</span></li>
${topics.map((t) => html`<li style="--c:${t.color}"><a href="${href(`feeds/${t.id}.xml`)}"><i aria-hidden="true"></i>${t.name}</a><span>Every story in this topic</span></li>`)}
</ul>
<p>The same data is available as JSON at <a href="${href("api/latest.json")}"><code>/api/latest.json</code></a> and <code>/api/issues/YYYY-MM-DD.json</code>.</p>

<h2 class="doc-h2">Privacy</h2>
<p>No cookies, no analytics and no third-party requests. Fonts are served from this site. Read marks, your theme and your pinned or muted topics are kept in your browser’s local storage and never leave it.</p>

<h2 class="doc-h2">Make it yours</h2>
<p>Choose <b>Edit</b> next to Topics to pin a topic, so all of its stories join Top stories, or mute it, so it disappears everywhere except its own view. <b>This week</b> collects the 20 strongest stories of the last seven days, for catching up after time off.</p>

<h2 class="doc-h2">Keyboard</h2>
<dl class="keys-list">
<div><dt><kbd>J</kbd> <kbd>K</kbd></dt><dd>Next and previous story</dd></div>
<div><dt><kbd>O</kbd></dt><dd>Open the story in a new tab</dd></div>
<div><dt><kbd>F</kbd></dt><dd>Focus: one story per screen</dd></div>
<div><dt><kbd>/</kbd></dt><dd>Filter the list by any word</dd></div>
<div><dt><kbd>Esc</kbd></dt><dd>Leave focus or clear the filter</dd></div>
</dl>`;
  return layout({
    title: `How it works · ${site.name}`,
    description: `How ${site.name} picks and ranks the day’s AI news without a model.`,
    path: "about/",
    body: shell(content, "about"),
    bodyClass: "page",
  });
}
