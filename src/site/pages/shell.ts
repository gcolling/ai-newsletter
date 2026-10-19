import { site } from "../../config.ts";
import { type Html, html } from "../html.ts";
import { href } from "../layout.ts";

/** Cycles Auto → Light → Dark. The label is filled in by the script; Auto is the no-JS truth. */
export function themeToggle(): Html {
  return html`<button class="theme-toggle" type="button" data-theme-toggle>Theme: Auto</button>`;
}

/** Frame for the quieter pages (archive, about, 404): brand on top, one readable column. */
export function shell(content: Html, current: "archive" | "about" | "saved" | ""): Html {
  const link = (path: string, label: string, id: typeof current) =>
    html`<a href="${href(path)}"${id === current ? html` aria-current="page"` : ""}>${label}</a>`;
  return html`<div class="doc">
<header class="doc-head">
<a class="brand" href="${href()}">${site.name}</a>
<nav aria-label="Site">${link("", "Today", "")}${link("week/", "This week", "")}${link("saved/", "Saved", "saved")}${link("archive/", "Archive", "archive")}${link("about/", "How it works", "about")}${link("feed.xml", "RSS", "")}</nav>
</header>
<main class="doc-main">
${content}
</main>
<footer class="doc-foot"><p>${site.tagline} <a href="${site.repo}">Source on GitHub</a>.</p>${themeToggle()}</footer>
</div>`;
}
