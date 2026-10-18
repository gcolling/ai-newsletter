import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sourceHealth } from "../../src/site/health.ts";
import type { Issue } from "../../src/types.ts";

const run = (date: string, failed: string[], storiesFrom: string[] = []): Issue => ({
  version: 1,
  date,
  generatedAt: `${date}T05:20:00.000Z`,
  window: { from: `${date}T00:00:00.000Z`, to: `${date}T05:20:00.000Z` },
  sources: { total: 3, ok: 3 - failed.length, failed },
  stories: storiesFrom.map((id, i) => ({
    id: `${date}-${i}`,
    title: "t",
    url: "https://example.com/",
    host: "example.com",
    summary: "",
    publishedAt: `${date}T04:00:00.000Z`,
    source: { id, name: id },
    section: "news",
    topic: "agents",
    score: 1,
    reasons: [],
    also: [],
  })),
});

describe("source health", () => {
  // Newest first, like the site loads them.
  const issues = [
    run("2026-10-18", ["blocked", "wobbly"], ["steady"]),
    run("2026-10-17", ["blocked"], ["steady", "wobbly"]),
    run("2026-10-16", ["blocked"]),
    run("2026-10-15", [], ["blocked"]),
  ];
  const health = sourceHealth(issues, ["steady", "wobbly", "blocked"]);

  it("marks a source failing when it missed the last three runs", () => {
    assert.equal(health.get("blocked")?.state, "failing");
  });

  it("marks a source flaky when it missed a run this week", () => {
    assert.equal(health.get("wobbly")?.state, "flaky");
    assert.equal(health.get("wobbly")?.failedRuns, 1);
  });

  it("counts the stories each source led with", () => {
    assert.deepEqual(health.get("steady"), { stories: 2, failedRuns: 0, state: "ok" });
    assert.equal(health.get("blocked")?.stories, 1);
  });
});
