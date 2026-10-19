import { site } from "../../config.ts";
import { topicById } from "../../topics.ts";
import { html } from "../html.ts";
import { href, layout } from "../layout.ts";
import { shell } from "./shell.ts";

export function notFoundPage(): string {
  const content = html`<div class="empty-card">
<h2>Try one of these</h2>
<p>Issues live at dates like <code>/2026/10/18/</code>.</p>
<p><a class="pill-btn" href="${href()}">Today’s issue</a> <a class="pill-btn" href="${href("archive/")}">Archive</a></p>
</div>`;
  return layout({
    title: `Not found · ${site.name}`,
    description: site.tagline,
    path: "404.html",
    body: shell(content, "", {
      title: "Not here",
      lede: "That page doesn’t exist, or it moved.",
      color: topicById.get("industry")?.color ?? "#6E0A1E",
    }),
    bodyClass: "page",
  });
}
