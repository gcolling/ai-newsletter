import { site } from "../config.ts";
import { type Html, html, raw } from "./html.ts";

/** Versioned asset URLs, filled in by the build once files are hashed. */
export const assets = { css: "", js: "", icon: "", preload: [] as string[] };

/** Internal link, respecting the base path the site is served under. */
export const href = (path = "") => site.basePath + path.replace(/^\//, "");

/** Absolute URL for feeds and social cards. */
export const absolute = (path = "") => `${site.url}/${path.replace(/^\//, "")}`;

/** Runs before first paint: marks JS as available and applies a saved theme, so nothing flashes. */
const THEME_BOOT =
  'var d=document.documentElement;d.className="js";try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")d.dataset.theme=t;var l=JSON.parse(localStorage.getItem("layout-v1")||"{}");if(l.rail>0)d.style.setProperty("--rail-w",l.rail+"px");if(l.list>0)d.style.setProperty("--list-w",l.list+"px")}catch(e){}';

interface Page {
  title: string;
  description: string;
  /** Site-relative path of this page, e.g. "archive/". */
  path: string;
  body: Html;
  bodyClass?: string;
}

export function layout(page: Page): string {
  const doc = html`<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<link rel="canonical" href="${absolute(page.path)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${site.name}">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:url" content="${absolute(page.path)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#EEF0F3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0D0F13" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${assets.icon}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${href("assets/apple-touch-icon.png")}">
<link rel="manifest" href="${href("manifest.webmanifest")}">
<meta name="apple-mobile-web-app-title" content="${site.name}">
<link rel="alternate" type="application/atom+xml" title="${site.name}" href="${href("feed.xml")}">
<link rel="alternate" type="application/atom+xml" title="${site.name}: top stories" href="${href("feeds/top.xml")}">
${assets.preload.map(
  (font) => html`<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin>
`,
)}<link rel="stylesheet" href="${assets.css}">
<script>${raw(THEME_BOOT)}</script>
<script src="${assets.js}" defer></script>
</head>
<body class="${page.bodyClass ?? ""}">
<a class="skip-link" href="#main">Skip to content</a>
${page.body}
</body>
</html>
`;
  return doc.value;
}
