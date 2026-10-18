import { site } from "../../config.ts";
import { type Html, html } from "../html.ts";
import { href } from "../layout.ts";

/** Frame for the quieter pages (archive, about, 404): brand on top, one readable column. */
export function shell(content: Html, current: "archive" | "about" | ""): Html {
  const link = (path: string, label: string, id: typeof current) =>
    html`<a href="${href(path)}"${id === current ? html` aria-current="page"` : ""}>${label}</a>`;
  return html`<div class="doc">
<header class="doc-head">
<a class="brand" href="${href()}">${site.name}</a>
<nav aria-label="Site">${link("", "Today", "")}${link("archive/", "Archive", "archive")}${link("about/", "How it works", "about")}${link("feed.xml", "RSS", "")}</nav>
</header>
<main class="doc-main">
${content}
</main>
<footer class="doc-foot"><p>${site.tagline} <a href="${site.repo}">Source on GitHub</a>.</p></footer>
</div>`;
}
