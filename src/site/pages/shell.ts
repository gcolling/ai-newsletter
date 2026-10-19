import { site } from "../../config.ts";
import { type GlyphName, glyph } from "../glyphs.ts";
import { type Html, html } from "../html.ts";
import { assets, href } from "../layout.ts";

/** Which top-bar link is the current page, if any. */
export type Place = "today" | "week" | "saved" | "archive" | "about" | "";

/** Three icons, the current one pressed: follow the system, light, dark. Needs the script. */
export function themeToggle(): Html {
  const option = (value: string, label: string, icon: GlyphName) =>
    html`<button type="button" data-theme-set="${value}" aria-pressed="${value === "auto" ? "true" : "false"}" aria-label="${label}" title="${label}">${glyph(icon)}</button>`;
  return html`<div class="theme-switch" role="group" aria-label="Theme">${option("auto", "Match your system", "monitor")}${option("light", "Light", "sun")}${option("dark", "Dark", "moon")}</div>`;
}

/** The same bar on every page: where you are, where you can go, and the theme. */
export function topbar(current: Place): Html {
  const link = (path: string, label: string, id: Place, attrs: Html | "" = "") =>
    html`<a href="${href(path)}"${id === current ? html` aria-current="page"` : ""}${attrs}>${label}</a>`;
  return html`<header class="topbar">
<a class="brand" href="${href()}"><img src="${assets.icon}" alt="" width="22" height="22">${site.name}</a>
<nav class="site-nav" aria-label="Site">
${link("", "Today", "today")}${link("week/", "This week", "week")}${link("saved/", "Saved", "saved", html` data-saved-link`)}${link("archive/", "Archive", "archive")}${link("about/", "How it works", "about")}
</nav>
<div class="topbar-end"><a class="feed-link" href="${href("feed.xml")}">RSS</a>${themeToggle()}</div>
</header>`;
}

interface Hero {
  title: string;
  lede: Html | string;
  /** Gem color of the header card. */
  color: string;
}

/** Frame for the pages around the reader: top bar, a colored header card, then wide content. */
export function shell(content: Html, current: Place, hero: Hero): Html {
  return html`${topbar(current)}
<div class="doc">
<header class="hero" style="--c:${hero.color}">
<h1 class="hero-title">${hero.title}</h1>
<p class="hero-lede">${hero.lede}</p>
</header>
<main class="doc-main">
${content}
</main>
<footer class="doc-foot"><p>${site.tagline} <a href="${site.repo}">Source on GitHub</a>.</p></footer>
</div>`;
}
