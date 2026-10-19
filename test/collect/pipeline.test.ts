import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Candidate } from "../../src/collect/candidate.ts";
import { assembleStories, capBySource } from "../../src/collect/pipeline.ts";
import type { Seen } from "../../src/collect/store.ts";
import type { TopicId } from "../../src/types.ts";
import { hoursAgo, story, testSource, WINDOW } from "./helpers.ts";

const nothingSeen: Seen = { ids: new Set(), urls: new Set(), discussions: new Set() };
const noPins = new Map<string, TopicId>();

describe("capBySource", () => {
  it("keeps the best-scoring items of a chatty source", () => {
    const items = [
      story({ title: "Old and plain", publishedAt: hoursAgo(23) }),
      story({ title: "Fresh MCP agents news", publishedAt: hoursAgo(1) }),
      story({ title: "Fresh but plain", publishedAt: hoursAgo(1) }),
    ];
    const kept = capBySource(items, 2, WINDOW).map((c) => c.title);
    assert.deepEqual(kept, ["Fresh MCP agents news", "Fresh but plain"]);
  });
});

describe("assembleStories", () => {
  const verge = testSource({ id: "verge-ai", name: "The Verge", weight: 2 });
  const decoder = testSource({ id: "the-decoder", name: "The Decoder", weight: 1, maxItems: 1 });

  function run(
    feeds: { source: typeof verge; candidates: Candidate[] }[],
    extra: Partial<Parameters<typeof assembleStories>[0]> = {},
  ) {
    return assembleStories({
      feeds,
      community: [],
      papers: [],
      seen: nothingSeen,
      window: WINDOW,
      pinnedTopics: noPins,
      ...extra,
    });
  }

  it("merges two outlets on the same story and ranks the result first", () => {
    const fromVerge = story({
      title: "OpenAI launches GPT-6 with a million-token context window",
      sourceId: "verge-ai",
      sourceName: "The Verge",
      url: "https://www.theverge.com/gpt-6",
    });
    const fromDecoder = story({
      title: "GPT-6 launches at OpenAI with million-token context window",
      sourceId: "the-decoder",
      sourceName: "The Decoder",
      weight: 1,
      url: "https://the-decoder.com/gpt-6",
    });
    const other = story({
      title: "Quiet news",
      sourceId: "verge-ai",
      url: "https://www.theverge.com/q",
    });

    const stories = run([
      { source: verge, candidates: [fromVerge, other] },
      { source: decoder, candidates: [fromDecoder] },
    ]);

    assert.equal(stories.length, 2);
    assert.equal(stories[0]?.title, fromVerge.title);
    assert.equal(stories[0]?.reasons[0], "Covered by 2 outlets");
    assert.equal(stories[0]?.topic, "models");
  });

  it("skips stories already published in an earlier issue", () => {
    const repeat = story({ title: "Seen yesterday", url: "https://www.theverge.com/seen" });
    const seen: Seen = { ids: new Set(), urls: new Set([repeat.key]), discussions: new Set() };
    assert.deepEqual(run([{ source: verge, candidates: [repeat] }], { seen }), []);
  });

  it("respects a source's maxItems", () => {
    const items = [
      story({ title: "Decoder one", sourceId: "the-decoder" }),
      story({ title: "Decoder two", sourceId: "the-decoder" }),
    ];
    assert.equal(run([{ source: decoder, candidates: items }]).length, 1);
  });

  it("attaches a Hacker News thread to the feed story it links to instead of duplicating it", () => {
    const article = story({
      title: "A post",
      sourceId: "verge-ai",
      url: "https://www.theverge.com/post",
    });
    const hn = story({
      title: "A post",
      section: "community",
      sourceId: "hacker-news",
      weight: 1,
      url: "https://www.theverge.com/post",
      discussion: {
        site: "Hacker News",
        url: "https://news.ycombinator.com/item?id=7",
        points: 300,
        comments: 100,
      },
    });

    const stories = run([{ source: verge, candidates: [article] }], { community: [[hn]] });

    assert.equal(stories.length, 1);
    assert.equal(stories[0]?.source.id, "verge-ai");
    assert.equal(stories[0]?.discussion?.points, 300);
  });

  it("lets an off-topic forum post lend its discussion, but never become a story", () => {
    const article = story({
      title: "Chirp Pong",
      sourceId: "verge-ai",
      url: "https://example.com/pong",
    });
    const discussion = {
      site: "Hacker News" as const,
      url: "https://news.ycombinator.com/item?id=8",
      points: 200,
      comments: 40,
    };
    const linked = story({
      title: "Chirp Pong",
      section: "community",
      url: article.url,
      discussion,
    });
    const unrelated = story({
      title: "A motion control platform",
      section: "community",
      url: "https://example.com/motion",
      discussion: { ...discussion, url: "https://news.ycombinator.com/item?id=9" },
    });
    linked.offTopic = true;
    unrelated.offTopic = true;

    const stories = run([{ source: verge, candidates: [article] }], {
      community: [[linked, unrelated]],
    });

    assert.deepEqual(
      stories.map((s) => s.title),
      ["Chirp Pong"],
    );
    assert.equal(stories[0]?.discussion?.points, 200);
  });

  it("uses a topic pinned in sources.ts", () => {
    const item = story({ title: "GPU news", sourceId: "verge-ai" });
    const stories = run([{ source: verge, candidates: [item] }], {
      pinnedTopics: new Map<string, TopicId>([["verge-ai", "policy"]]),
    });
    assert.equal(stories[0]?.topic, "policy");
  });
});
