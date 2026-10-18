import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { weekIssue, weekPage } from "../../src/site/pages/week.ts";
import type { Issue, Story } from "../../src/types.ts";

const story = (id: string, score: number, section: Story["section"] = "news"): Story => ({
  id,
  title: `Story ${id}`,
  url: `https://example.com/${id}`,
  host: "example.com",
  summary: "",
  publishedAt: "2026-10-10T08:00:00.000Z",
  source: { id: "example", name: "Example" },
  section,
  topic: "agents",
  score,
  reasons: [],
  also: [],
});

const issue = (date: string, stories: Story[]): Issue => ({
  version: 1,
  date,
  generatedAt: `${date}T05:20:00.000Z`,
  window: { from: `${date}T00:00:00.000Z`, to: `${date}T05:20:00.000Z` },
  sources: { total: 1, ok: 1, failed: [] },
  stories,
});

describe("this week", () => {
  const issues = [
    issue("2026-10-18", [story("a", 30), story("rel", 99, "releases")]),
    issue("2026-10-15", [story("b", 50), story("c", 10)]),
    issue("2026-10-12", [story("d", 70)]),
    issue("2026-10-11", [story("old", 100)]),
  ];

  it("ranks the last seven days together and skips release notes", () => {
    const week = weekIssue(issues);
    assert.deepEqual(
      week?.stories.map((s) => s.id),
      ["d", "b", "a", "c"],
    );
  });

  it("spans from the oldest to the newest issue in the week", () => {
    const week = weekIssue(issues);
    assert.equal(week?.window.from, "2026-10-12T00:00:00.000Z");
    assert.equal(week?.window.to, "2026-10-18T05:20:00.000Z");
  });

  it("titles the page with the date range", () => {
    const page = weekPage(issues) ?? "";
    assert.ok(page.includes("12 October – 18 October"));
    assert.ok(page.includes("That’s the week."));
  });

  it("has nothing to show without issues", () => {
    assert.equal(weekIssue([]), undefined);
    assert.equal(weekPage([]), undefined);
  });
});
