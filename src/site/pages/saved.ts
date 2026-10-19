import { site } from "../../config.ts";
import { html } from "../html.ts";
import { href, layout } from "../layout.ts";
import { shell } from "./shell.ts";

/**
 * Saved stories live only in the reader's browser (local storage), so this page is an empty shell
 * the script fills in. Nothing about what you save ever reaches the server or the repository.
 */
export function savedPage(): string {
  const content = html`<h1 class="doc-title">Saved</h1>
<p class="doc-lede">Stories you keep for later, across days. They stay in this browser only.</p>
<div class="saved-tools" data-saved-tools hidden>
<button class="pill-btn" type="button" data-saved-copy>Copy as Markdown</button>
<button class="pill-btn" type="button" data-saved-clear>Clear all</button>
</div>
<ol class="saved" data-saved-list></ol>
<p class="saved-empty" data-saved-empty>Nothing saved yet. Choose <b>Save</b> on any story, or press <kbd>S</kbd>, and it will wait here. <a href="${href()}">Read today’s issue</a>.</p>
<noscript><p>Saving stories needs JavaScript.</p></noscript>`;
  return layout({
    title: `Saved · ${site.name}`,
    description: "Stories you saved for later.",
    path: "saved/",
    body: shell(content, "saved"),
    bodyClass: "page",
  });
}
