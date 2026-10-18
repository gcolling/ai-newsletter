import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isSeen,
  issueDate,
  issueWindow,
  previousIssues,
  readIssues,
  seenInHistory,
  writeIssue,
} from "../../src/collect/store.ts";
import type { Issue, Story } from "../../src/types.ts";
import { NOW, story } from "./helpers.ts";

const settings = { firstWindowHours: 26, maxWindowHours: 72 };

function issue(date: string, windowTo: string, stories: Partial<Story>[] = []): Issue {
  return {
    version: 1,
    date,
    generatedAt: windowTo,
    window: { from: "2026-10-01T00:00:00.000Z", to: windowTo },
    sources: { total: 1, ok: 1, failed: [] },
    stories: stories.map((s) => ({ ...story({ title: "x" }), ...s })),
  };
}

describe("issueWindow", () => {
  it("looks back firstWindowHours when there is no history", () => {
    const window = issueWindow([], NOW, settings);
    assert.equal(window.from.toISOString(), "2026-10-17T04:00:00.000Z");
    assert.equal(window.to, NOW);
  });

  it("continues where the latest issue stopped", () => {
    const window = issueWindow([issue("2026-10-17", "2026-10-17T06:02:00.000Z")], NOW, settings);
    assert.equal(window.from.toISOString(), "2026-10-17T06:02:00.000Z");
  });

  it("never reaches back more than maxWindowHours after a gap", () => {
    const window = issueWindow([issue("2026-10-01", "2026-10-01T06:00:00.000Z")], NOW, settings);
    assert.equal(window.from.toISOString(), "2026-10-15T06:00:00.000Z");
  });

  it("ignores today's own issue, because a re-run replaces it", () => {
    const history = [
      issue("2026-10-18", "2026-10-18T05:00:00.000Z"),
      issue("2026-10-17", "2026-10-17T06:00:00.000Z"),
    ];
    const window = issueWindow(previousIssues(history, "2026-10-18"), NOW, settings);
    assert.equal(window.from.toISOString(), "2026-10-17T06:00:00.000Z");
  });
});

describe("seenInHistory and isSeen", () => {
  const yesterday = issue("2026-10-17", "2026-10-17T06:00:00.000Z", [
    {
      id: "abc1234567",
      url: "https://example.com/seen/?utm_source=rss",
      also: [{ source: "Other", title: "Same", url: "https://other.example/same" }],
      discussion: {
        site: "Hacker News",
        url: "https://news.ycombinator.com/item?id=42",
        points: 100,
        comments: 10,
      },
    },
  ]);
  const longAgo = issue("2026-10-01", "2026-10-01T06:00:00.000Z", [
    { id: "old0000000", url: "https://example.com/old" },
  ]);
  const seen = seenInHistory([yesterday, longAgo], "2026-10-18", 7);

  it("remembers ids, canonical URLs, merged URLs and discussions", () => {
    assert.ok(seen.ids.has("abc1234567"));
    assert.ok(seen.urls.has("https://example.com/seen"));
    assert.ok(seen.urls.has("https://other.example/same"));
    assert.ok(seen.discussions.has("https://news.ycombinator.com/item?id=42"));
  });

  it("only looks back dedupeDays", () => {
    assert.equal(seen.ids.has("old0000000"), false);
  });

  it("matches a story by canonical URL", () => {
    assert.equal(
      isSeen(story({ title: "Again", url: "https://example.com/seen#top" }), seen),
      true,
    );
  });

  it("matches a forum post by its discussion URL", () => {
    const repost = story({
      title: "New link, same thread",
      url: "https://example.com/new",
      discussion: {
        site: "Hacker News",
        url: "https://news.ycombinator.com/item?id=42",
        points: 300,
        comments: 50,
      },
    });
    assert.equal(isSeen(repost, seen), true);
  });

  it("lets new stories through", () => {
    assert.equal(
      isSeen(story({ title: "Brand new", url: "https://example.com/new" }), seen),
      false,
    );
  });
});

describe("issueDate", () => {
  it("is the UTC date of the run", () => {
    assert.equal(issueDate(new Date("2026-10-18T23:30:00-05:00")), "2026-10-19");
  });

  it("accepts an ISSUE_DATE override for local testing", () => {
    assert.equal(issueDate(NOW, "2026-10-01"), "2026-10-01");
  });

  it("rejects a malformed override", () => {
    assert.throws(() => issueDate(NOW, "18/10/2026"), /YYYY-MM-DD/);
  });
});

describe("writeIssue and readIssues", () => {
  it("round-trips an issue as pretty JSON and leaves no temp file behind", async () => {
    const dir = await mkdtemp(join(tmpdir(), "collect-store-"));
    try {
      const original = issue("2026-10-18", "2026-10-18T06:00:00.000Z");
      const file = await writeIssue(join(dir, "issues"), original);
      assert.ok(file.endsWith("2026-10-18.json"));
      assert.deepEqual(await readdir(join(dir, "issues")), ["2026-10-18.json"]);

      const [read] = await readIssues(join(dir, "issues"), () => {});
      assert.deepEqual(read, original);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips files that are not issues and reports them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "collect-store-"));
    try {
      await writeFile(join(dir, "2026-10-17.json"), "{ not json");
      await writeFile(join(dir, "notes.txt"), "ignored by name");
      const warnings: string[] = [];
      const issues = await readIssues(dir, (message) => warnings.push(message));
      assert.deepEqual(issues, []);
      assert.equal(warnings.length, 1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns no issues when the folder does not exist yet", async () => {
    assert.deepEqual(await readIssues(join(tmpdir(), "collect-store-missing-dir"), () => {}), []);
  });
});
