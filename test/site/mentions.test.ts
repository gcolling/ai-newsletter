import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { termsOf, topMentions } from "../../src/site/mentions.ts";
import type { Story } from "../../src/types.ts";

const story = (title: string, summary = ""): Story => ({
  id: title,
  title,
  url: "https://example.com/",
  host: "example.com",
  summary,
  publishedAt: "2026-10-18T05:00:00.000Z",
  source: { id: "example", name: "Example" },
  section: "news",
  topic: "agents",
  score: 1,
  reasons: [],
  also: [],
});

describe("most mentioned", () => {
  it("finds the AI terms a story mentions, leaving out generic ones like AI", () => {
    assert.deepEqual(termsOf(story("AI startup ships an MCP server for Claude")).sort(), [
      "Claude",
      "MCP",
    ]);
  });

  it("counts each story once per term and needs two stories to show a term", () => {
    const stories = [
      story("MCP everywhere", "MCP, MCP and more MCP"),
      story("Another MCP server"),
      story("A lone mention of DeepSeek"),
    ];
    assert.deepEqual(topMentions(stories), [{ term: "MCP", count: 2, previous: undefined }]);
  });

  it("compares with the period before when there is one", () => {
    const now = [story("MCP one"), story("MCP two"), story("MCP three")];
    const before = [story("MCP last week")];
    assert.deepEqual(topMentions(now, before), [{ term: "MCP", count: 3, previous: 1 }]);
  });
});
