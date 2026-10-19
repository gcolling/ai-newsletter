import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeEntities,
  htmlToBlocks,
  htmlToText,
  isTitleEcho,
  makeSummary,
  removeBoilerplate,
  stripLeadingTitle,
  truncate,
} from "../../src/collect/text.ts";

describe("decodeEntities", () => {
  it("decodes named, decimal and hex references", () => {
    assert.equal(
      decodeEntities("Q&amp;A &mdash; it&#8217;s &#x2014; done&hellip;"),
      "Q&A — it’s — done…",
    );
  });

  it("leaves unknown names untouched", () => {
    assert.equal(decodeEntities("&notarealentity; stays"), "&notarealentity; stays");
  });
});

describe("htmlToText", () => {
  it("strips tags and collapses whitespace", () => {
    assert.equal(htmlToText("<p>Hello\n  <b>world</b></p>"), "Hello world");
  });

  it("decodes twice for double-encoded feeds", () => {
    assert.equal(htmlToText("Fish &amp;amp; chips"), "Fish & chips");
  });

  it("does not treat decoded text as markup", () => {
    assert.equal(htmlToText("Use &lt;div&gt; for layout"), "Use <div> for layout");
  });
});

describe("htmlToBlocks", () => {
  it("splits paragraphs and list items, dropping headings, captions and code", () => {
    const html = `<h2>What's Changed</h2>
      <figure><img src="x.png"><figcaption>Photo: someone</figcaption></figure>
      <p>First paragraph.</p><pre>npm install</pre><ul><li>One</li><li>Two</li></ul>`;
    assert.deepEqual(htmlToBlocks(html), ["First paragraph.", "One", "Two"]);
  });
});

describe("removeBoilerplate", () => {
  it('removes WordPress "The post … appeared first on …"', () => {
    assert.equal(
      removeBoilerplate("Real text here. The post Big News appeared first on The GitHub Blog."),
      "Real text here.",
    );
  });

  it("turns a trailing […] teaser marker into a plain ellipsis", () => {
    assert.equal(
      removeBoilerplate("Meta may use content to provide, develop, improve, […]"),
      "Meta may use content to provide, develop, improve…",
    );
    assert.equal(removeBoilerplate("A complete sentence. [...]"), "A complete sentence.");
  });

  it('removes "Continue reading" and what follows', () => {
    assert.equal(
      removeBoilerplate("A short teaser. Continue reading on the site →"),
      "A short teaser.",
    );
  });
});

describe("truncate", () => {
  it("leaves short text alone", () => {
    assert.equal(truncate("Short.", 40), "Short.");
  });

  it("cuts at the last full sentence when one ends past the halfway mark", () => {
    const text = "First sentence is here. Second sentence is a bit longer than the first one.";
    assert.equal(truncate(text, 40), "First sentence is here.");
  });

  it("otherwise cuts at a word boundary and adds an ellipsis", () => {
    const text = "One very long sentence without any full stop that keeps going and going";
    assert.equal(truncate(text, 40), "One very long sentence without any…");
  });

  it("never returns more than the limit", () => {
    const text = "word ".repeat(200);
    assert.ok(truncate(text, 280).length <= 280);
  });
});

describe("isTitleEcho and stripLeadingTitle", () => {
  it("treats a summary equal to (or inside) the title as an echo", () => {
    assert.equal(isTitleEcho("Codex app", "Codex app"), true);
    assert.equal(isTitleEcho("0.163.0", "Codex CLI Release: 0.163.0"), true);
    assert.equal(isTitleEcho("A real summary.", "Codex app"), false);
  });

  it("drops a repeated title followed by a separator", () => {
    assert.equal(
      stripLeadingTitle("Big launch today — The company shipped it.", "Big launch today"),
      "The company shipped it.",
    );
  });

  it("keeps a sentence that merely starts with the title's words", () => {
    assert.equal(
      stripLeadingTitle("Codex app now supports themes.", "Codex app"),
      "Codex app now supports themes.",
    );
  });

  it('drops a "Label: Title" heading line', () => {
    assert.equal(
      stripLeadingTitle("Tool: Chirp Pong Another game experiment.", "Chirp Pong"),
      "Another game experiment.",
    );
  });
});

describe("makeSummary", () => {
  const max = 280;

  it("prefers the description", () => {
    assert.equal(
      makeSummary("Title", "<p>From the description.</p>", "<p>From the content.</p>", max),
      "From the description.",
    );
  });

  it("falls back to the opening of the full content when the description is empty", () => {
    const content = "<h2>Intro</h2><p>The first paragraph of the post.</p><p>More.</p>";
    assert.equal(makeSummary("Title", "", content, max), "The first paragraph of the post. More.");
  });

  it("falls back to the content when the description only repeats the title", () => {
    assert.equal(
      makeSummary("An update on evaluators", "An update on evaluators", "<p>Details.</p>", max),
      "Details.",
    );
  });

  it('returns "" when nothing says more than the title', () => {
    assert.equal(makeSummary("An update on evaluators", "An update on evaluators", "", max), "");
  });

  it("strips boilerplate and skips byline labels", () => {
    const description =
      "<p>Jane Doe / Example News:</p><p>The real lede.</p><p>The post X appeared first on Y.</p>";
    assert.equal(makeSummary("Title", description, "", max), "The real lede.");
  });

  it("truncates long full-post descriptions", () => {
    const description = `<p>${"This sentence is filler text. ".repeat(30)}</p>`;
    const summary = makeSummary("Title", description, "", max);
    assert.ok(summary.length <= max);
    assert.ok(summary.endsWith("."));
  });
});
