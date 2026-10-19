import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { atomFeed } from "../../src/site/feed.ts";
import { escapeHtml, html, safeUrl } from "../../src/site/html.ts";
import { archivePage } from "../../src/site/pages/archive.ts";
import { issuePage, topStories } from "../../src/site/pages/issue.ts";
import type { Issue } from "../../src/types.ts";

const fixture = async (date: string): Promise<Issue> =>
  JSON.parse(await readFile(`test/fixtures/issues/${date}.json`, "utf8"));

describe("html templating", () => {
  it("escapes interpolated text", () => {
    assert.equal(
      html`<p>${'<img src=x onerror="alert(1)">'}</p>`.value,
      "<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>",
    );
  });

  it("does not double-escape nested templates", () => {
    assert.equal(
      html`<ul>${[html`<li>${"a & b"}</li>`]}</ul>`.value,
      "<ul><li>a &amp; b</li></ul>",
    );
  });

  it("escapes quotes so values are safe inside attributes", () => {
    assert.equal(escapeHtml(`" onmouseover='x'`), "&quot; onmouseover=&#39;x&#39;");
  });

  it("only lets http(s) links through", () => {
    assert.equal(safeUrl("javascript:alert(1)"), "#");
    assert.equal(safeUrl("data:text/html,hi"), "#");
    assert.equal(safeUrl("not a url"), "#");
    assert.equal(safeUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
  });
});

describe("issue page", () => {
  it("renders every story once in the list and once on the stage", async () => {
    const issue = await fixture("2026-10-18");
    const page = issuePage(issue, {}, true);
    for (const story of issue.stories) {
      assert.equal(page.split(`id="r-${story.id}"`).length - 1, 1, `row for ${story.id}`);
      assert.equal(page.split(`id="s-${story.id}"`).length - 1, 1, `card for ${story.id}`);
    }
  });

  it("keeps release notes out of the top stories", async () => {
    const issue = await fixture("2026-10-18");
    const top = topStories(issue);
    assert.ok(top.length > 0 && top.length <= 12);
    assert.ok(top.every((s) => s.section !== "releases"));
  });

  it("lets at most two papers into the top stories", async () => {
    const issue = await fixture("2026-10-18");
    const [first] = issue.stories;
    assert.ok(first);
    const papers = Array.from({ length: 5 }, (_, i) => ({
      ...first,
      id: `paper${i}`,
      section: "papers" as const,
      score: 100 - i,
    }));
    const top = topStories({ ...issue, stories: [...papers, ...issue.stories] });
    assert.equal(top.filter((s) => s.section === "papers").length, 2);
    assert.equal(top.length, 12);
  });

  it("neutralises hostile feed content", async () => {
    const issue = await fixture("2026-10-18");
    const [first] = issue.stories;
    assert.ok(first);
    const evil: Issue = {
      ...issue,
      stories: [{ ...first, title: "<script>alert(1)</script>", url: "javascript:alert(1)" }],
    };
    const page = issuePage(evil, {}, true);
    assert.ok(!page.includes("<script>alert(1)</script>"));
    assert.ok(!page.includes('href="javascript:'));
  });
});

describe("archive and feed", () => {
  it("lists issues newest first and links each one", async () => {
    const issues = [await fixture("2026-10-18"), await fixture("2026-10-17")];
    const page = archivePage(issues);
    assert.ok(page.indexOf("/2026/10/18/") < page.indexOf("/2026/10/17/"));
  });

  it("produces one Atom entry per issue with escaped HTML content", async () => {
    const issues = [await fixture("2026-10-18"), await fixture("2026-10-17")];
    const feed = atomFeed(issues);
    assert.ok(feed.startsWith('<?xml version="1.0" encoding="utf-8"?>'));
    assert.equal(feed.split("<entry>").length - 1, 2);
    assert.ok(feed.includes('<content type="html">&lt;ol&gt;'));
  });
});
