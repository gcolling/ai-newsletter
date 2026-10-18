import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { storyFeeds } from "../../src/site/story-feeds.ts";
import type { Issue } from "../../src/types.ts";

const fixture = async (date: string): Promise<Issue> =>
  JSON.parse(await readFile(`test/fixtures/issues/${date}.json`, "utf8"));

describe("story feeds", async () => {
  const issues = [await fixture("2026-10-18"), await fixture("2026-10-17")];
  const feeds = storyFeeds(issues);
  const byPath = new Map(feeds.map((f) => [f.path, f.xml]));
  const entries = (xml = "") => xml.split("<entry>").length - 1;

  it("publishes a top-stories feed and one feed per topic", () => {
    assert.ok(byPath.has("feeds/top.xml"));
    assert.ok(byPath.has("feeds/automation.xml"));
    assert.equal(feeds.length, 9);
  });

  it("puts each story in exactly its own topic's feed", () => {
    const total = feeds
      .filter((f) => f.path !== "feeds/top.xml")
      .reduce((n, f) => n + entries(f.xml), 0);
    assert.equal(
      total,
      issues.reduce((n, i) => n + i.stories.length, 0),
    );
  });

  it("carries the day's top stories, never release notes", () => {
    const top = byPath.get("feeds/top.xml") ?? "";
    assert.equal(entries(top), 24);
    assert.ok(!top.includes("Claude Code 2.4.1"));
  });

  it("escapes story HTML inside the entry content", () => {
    const xml = byPath.get("feeds/policy.xml") ?? "";
    assert.ok(xml.includes('<content type="html">&lt;p&gt;'));
    assert.ok(!xml.includes("<p>"));
  });
});
