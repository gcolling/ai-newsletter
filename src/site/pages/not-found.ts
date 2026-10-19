import { site } from "../../config.ts";
import { html } from "../html.ts";
import { href, layout } from "../layout.ts";
import { shell } from "./shell.ts";

export function notFoundPage(): string {
  const content = html`<h1 class="doc-title">Not here</h1>
<p class="doc-lede">That page doesn’t exist. Issues live at dates like <code>/2026/10/18/</code>.</p>
<p><a href="${href()}">Read today’s issue</a> or browse the <a href="${href("archive/")}">archive</a>.</p>`;
  return layout({
    title: `Not found · ${site.name}`,
    description: site.tagline,
    path: "404.html",
    body: shell(content, ""),
    bodyClass: "page",
  });
}
