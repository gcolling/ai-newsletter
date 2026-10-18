import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discussionScore, rankAll, rankStory, recencyScore } from "../../src/collect/rank.ts";
import { hoursAgo, story, WINDOW } from "./helpers.ts";

/** A story with no bonuses at all: published at the very start of the window, no keywords. */
function plain(overrides: Parameters<typeof story>[0]) {
  return story({ publishedAt: WINDOW.from, ...overrides });
}

describe("rankStory: score", () => {
  it("starts from source weight × 10", () => {
    assert.equal(rankStory(plain({ title: "Quiet news", weight: 2 }), WINDOW).score, 20);
  });

  it("uses weight × 6 for releases", () => {
    const release = plain({ title: "Tool 1.2.0", section: "releases", weight: 3 });
    assert.equal(rankStory(release, WINDOW).score, 18);
  });

  it("adds 12 per additional outlet", () => {
    const covered = plain({ title: "Quiet news", weight: 2 });
    covered.outlets = 3;
    assert.equal(rankStory(covered, WINDOW).score, 20 + 24);
  });

  it("adds a log-scaled discussion bonus", () => {
    const discussed = plain({
      title: "Quiet news",
      section: "community",
      weight: 1,
      discussion: {
        site: "Hacker News",
        url: "https://news.ycombinator.com/item?id=1",
        points: 50,
        comments: 50,
      },
    });
    // 6·log2(2) + 3·log2(2) = 9
    assert.equal(rankStory(discussed, WINDOW).score, 10 + 9);
  });

  it("adds a log-scaled upvote bonus for papers", () => {
    const paper = plain({
      title: "A paper",
      section: "papers",
      weight: 1,
      paper: { upvotes: 50, arxivId: "2610.00001" },
    });
    // 8·log2(1 + 50/50) = 8
    assert.equal(rankStory(paper, WINDOW).score, 10 + 8);
  });

  it("adds 2 per strong keyword, capped at 8", () => {
    const one = plain({ title: "Notes on MCP" });
    const many = plain({ title: "MCP, RAG, LangChain, DSPy and LangGraph walk into a bar" });
    assert.equal(rankStory(one, WINDOW).score, 20 + 2);
    assert.equal(rankStory(many, WINDOW).score, 20 + 8);
  });

  it("adds 4 for a lab post, mirrored or not (mirrors copy the lab's own posts)", () => {
    const official = plain({ title: "Quiet news", section: "labs", weight: 3 });
    const mirrored = plain({ title: "Quiet news", section: "labs", weight: 3, mirror: true });
    assert.equal(rankStory(official, WINDOW).score, 34);
    assert.equal(rankStory(mirrored, WINDOW).score, 34);
    assert.deepEqual(rankStory(mirrored, WINDOW).reasons, ["Official announcement"]);
  });

  it("falls back to the source's weight when nothing else explains the pick", () => {
    assert.deepEqual(rankStory(plain({ title: "Quiet news", weight: 2 }), WINDOW).reasons, [
      "Solid source",
    ]);
  });

  it("gives up to 6 for recency, falling to 0 at the start of the window", () => {
    assert.equal(recencyScore(WINDOW.to.toISOString(), WINDOW), 6);
    assert.equal(recencyScore(hoursAgo(12).toISOString(), WINDOW), 3);
    assert.equal(recencyScore(WINDOW.from.toISOString(), WINDOW), 0);
    assert.equal(recencyScore(hoursAgo(48).toISOString(), WINDOW), 0);
  });

  it("takes 6 off funding-round headlines", () => {
    assert.equal(
      rankStory(plain({ title: "Acme raises $40M to build widgets" }), WINDOW).score,
      14,
    );
    assert.equal(rankStory(plain({ title: "Acme closes its Series B" }), WINDOW).score, 14);
  });

  it("rounds to one decimal", () => {
    // 20 + 6 × (1 − 7/24) = 24.25 before rounding
    const score = rankStory(story({ title: "Quiet news", publishedAt: hoursAgo(7) }), WINDOW).score;
    assert.equal(String(score), score.toFixed(1));
  });
});

describe("rankStory: reasons a reader sees", () => {
  it("describes coverage, discussion and upvotes in plain words", () => {
    const covered = plain({ title: "Quiet news" });
    covered.outlets = 3;
    const discussed = plain({
      title: "Quiet news",
      discussion: {
        site: "Hacker News",
        url: "https://news.ycombinator.com/item?id=1",
        points: 412,
        comments: 230,
      },
    });
    const paper = plain({ title: "Quiet paper", paper: { upvotes: 123, arxivId: "2610.00001" } });

    assert.deepEqual(rankStory(covered, WINDOW).reasons, ["Covered by 3 outlets"]);
    assert.deepEqual(rankStory(discussed, WINDOW).reasons, [
      "412 points · 230 comments on Hacker News",
    ]);
    assert.deepEqual(rankStory(paper, WINDOW).reasons, ["123 upvotes on Hugging Face"]);
  });

  it("names the matched keywords as written, skipping generic ones like AI", () => {
    const c = plain({ title: "AI agents meet MCP" });
    assert.deepEqual(rankStory(c, WINDOW).reasons, ["Matched: AI agents, MCP"]);
  });

  it("labels the kind of source", () => {
    assert.deepEqual(rankStory(plain({ title: "Quiet", section: "labs" }), WINDOW).reasons, [
      "Official announcement",
    ]);
    assert.deepEqual(rankStory(plain({ title: "Quiet", section: "essays" }), WINDOW).reasons, [
      "From a followed writer",
    ]);
    assert.deepEqual(rankStory(plain({ title: "Quiet", section: "releases" }), WINDOW).reasons, [
      "New release",
    ]);
  });

  it("puts the strongest outside signal first and keeps at most four reasons", () => {
    const c = plain({
      title: "Agentic MCP servers",
      section: "labs",
      discussion: { site: "Lobsters", url: "https://lobste.rs/s/x", points: 1000, comments: 500 },
      paper: { upvotes: 30, arxivId: "2610.00001" },
    });
    c.outlets = 2;
    const reasons = rankStory(c, WINDOW).reasons;
    assert.equal(reasons.length, 4);
    assert.equal(reasons[0], "1,000 points · 500 comments on Lobsters");
    assert.equal(reasons[1], "Covered by 2 outlets");
  });

  it("uses singular nouns for one", () => {
    const c = plain({
      title: "Quiet",
      discussion: {
        site: "Hacker News",
        url: "https://news.ycombinator.com/item?id=1",
        points: 1,
        comments: 1,
      },
    });
    assert.deepEqual(rankStory(c, WINDOW).reasons, ["1 point · 1 comment on Hacker News"]);
  });
});

describe("rankAll", () => {
  it("sorts best first", () => {
    const low = plain({ title: "Low", weight: 1 });
    const high = plain({ title: "High", weight: 3 });
    assert.deepEqual(
      rankAll([low, high], WINDOW).map((c) => c.title),
      ["High", "Low"],
    );
  });
});

describe("discussionScore", () => {
  it("weighs points twice as much as comments", () => {
    const points = discussionScore({ site: "Hacker News", url: "", points: 50, comments: 0 });
    const comments = discussionScore({ site: "Hacker News", url: "", points: 0, comments: 50 });
    assert.equal(points, 2 * comments);
  });
});
