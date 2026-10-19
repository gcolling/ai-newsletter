import { site } from "../../config.ts";
import { topicById } from "../../topics.ts";
import { html } from "../html.ts";
import { href, layout } from "../layout.ts";
import { shell } from "./shell.ts";

/**
 * Saved stories live only in the reader's browser (local storage), so this page is a shell the
 * script fills in. Nothing about what you save ever reaches the server or the repository.
 */
export function savedPage(): string {
  const content = html`<div class="saved-tools" data-saved-tools hidden>
<span class="saved-count" data-saved-count></span>
<button class="pill-btn" type="button" data-saved-copy>Copy as Markdown</button>
<button class="pill-btn" type="button" data-saved-clear>Clear all</button>
</div>
<ol class="saved-grid" data-saved-list></ol>
<div class="empty-card" data-saved-empty>
<h2>Nothing saved yet</h2>
<p>Choose <b>Save</b> on any story, or press <kbd>S</kbd>, and it waits here across days.</p>
<a class="pill-btn" href="${href()}">Read today’s issue</a>
</div>
<noscript><p>Saving stories needs JavaScript.</p></noscript>`;
  return layout({
    title: `Saved · ${site.name}`,
    description: "Stories you saved for later.",
    path: "saved/",
    body: shell(content, "saved", {
      title: "Saved",
      lede: "Stories you keep for later, across days. They stay in this browser only.",
      color: topicById.get("agents")?.color ?? "#5A189A",
    }),
    bodyClass: "page",
  });
}
