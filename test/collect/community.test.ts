import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type HnHit, hnCandidates, hnSearchUrl, parseHnHits } from "../../src/collect/hn.ts";
import {
  isRelevantLobsters,
  type LobstersStory,
  lobstersCandidates,
} from "../../src/collect/lobsters.ts";
import {
  type DailyPaper,
  paperCandidates,
  parsePapers,
  previousWeekday,
} from "../../src/collect/papers.ts";
import { hoursAgo, testSource, WINDOW } from "./helpers.ts";

function hit(overrides: Partial<HnHit>): HnHit {
  return {
    objectID: "50138531",
    title: "DeepSeek search and fetch API",
    url: "https://api-docs.deepseek.com/guides/search/",
    points: 327,
    num_comments: 158,
    created_at_i: Math.floor(hoursAgo(3).getTime() / 1000),
    ...overrides,
  };
}

describe("Hacker News", () => {
  it("asks Algolia for stories since 12 h before the window, with ≥ 20 points", () => {
    const url = new URL(hnSearchUrl(WINDOW));
    const since = Math.floor(WINDOW.from.getTime() / 1000) - 12 * 3600;
    assert.equal(url.pathname, "/api/v1/search_by_date");
    assert.match(url.searchParams.get("numericFilters") ?? "", new RegExp(`created_at_i>${since}`));
    assert.match(url.searchParams.get("numericFilters") ?? "", /points>=20/);
  });

  it("turns a relevant hit into a community story with its discussion", () => {
    const [candidate] = hnCandidates([hit({})], WINDOW);
    assert.equal(candidate?.section, "community");
    assert.deepEqual(candidate?.source, { id: "hacker-news", name: "Hacker News" });
    assert.equal(candidate?.url, "https://api-docs.deepseek.com/guides/search/");
    assert.deepEqual(candidate?.discussion, {
      site: "Hacker News",
      url: "https://news.ycombinator.com/item?id=50138531",
      points: 327,
      comments: 158,
    });
  });

  it("links text posts (Ask HN) to the thread itself", () => {
    const [candidate] = hnCandidates(
      [hit({ url: null, title: "Ask HN: Which LLM do you use?" })],
      WINDOW,
    );
    assert.equal(candidate?.url, "https://news.ycombinator.com/item?id=50138531");
  });

  it("drops low scores and stories outside the window", () => {
    const hits = [
      hit({ points: 12 }),
      hit({ created_at_i: Math.floor(hoursAgo(40).getTime() / 1000) }),
    ];
    assert.deepEqual(hnCandidates(hits, WINDOW), []);
  });

  it("marks titles that fail the AI rule as off-topic (they can only lend a discussion)", () => {
    const [offTopic] = hnCandidates(
      [hit({ title: "A sub-micrometer motion control platform" })],
      WINDOW,
    );
    const [onTopic] = hnCandidates([hit({})], WINDOW);
    assert.equal(offTopic?.offTopic, true);
    assert.equal(onTopic?.offTopic, false);
  });

  it("keeps stories from the 12 h before the window, because points take time", () => {
    const early = hit({ created_at_i: Math.floor(hoursAgo(30).getTime() / 1000) });
    assert.equal(hnCandidates([early], WINDOW).length, 1);
  });

  it("rejects a response without hits", () => {
    assert.throws(() => parseHnHits({ message: "error" }), /unexpected/);
  });
});

describe("Lobsters", () => {
  const lobsters = testSource({
    id: "lobsters-ai",
    name: "Lobsters",
    format: "json",
    section: "community",
  });

  function lobstersStory(overrides: Partial<LobstersStory>): LobstersStory {
    return {
      short_id: "abc123",
      created_at: hoursAgo(5).toISOString(),
      title: "Do you let LLMs write both your tests and your code?",
      url: "",
      score: 20,
      comment_count: 18,
      description: "<p>I'm curious what stance others have taken.</p>",
      comments_url: "https://lobste.rs/s/abc123/do_you_let_llms_write_both",
      tags: ["ask", "vibecoding"],
      ...overrides,
    };
  }

  it("keeps stories tagged ai or ml whatever the title says", () => {
    assert.equal(isRelevantLobsters({ title: "The Brain Sandwich", tags: ["ai"] }), true);
  });

  it("needs an AI title when the only tag is vibecoding", () => {
    assert.equal(isRelevantLobsters({ title: "The Brain Sandwich", tags: ["vibecoding"] }), false);
    assert.equal(isRelevantLobsters({ title: "Using LLMs for tests", tags: ["vibecoding"] }), true);
  });

  it("drops threads about Lobsters itself", () => {
    assert.equal(
      isRelevantLobsters({ title: "The vibecoding tag is harmful", tags: ["meta", "vibecoding"] }),
      false,
    );
  });

  it("uses the comments page as discussion and as the link of a text post", () => {
    const [candidate] = lobstersCandidates([lobstersStory({})], lobsters, WINDOW, 280);
    assert.equal(candidate?.url, "https://lobste.rs/s/abc123/do_you_let_llms_write_both");
    assert.equal(candidate?.summary, "I'm curious what stance others have taken.");
    assert.deepEqual(candidate?.discussion, {
      site: "Lobsters",
      url: "https://lobste.rs/s/abc123/do_you_let_llms_write_both",
      points: 20,
      comments: 18,
    });
  });

  it("needs a score of at least 10", () => {
    assert.deepEqual(lobstersCandidates([lobstersStory({ score: 9 })], lobsters, WINDOW, 280), []);
  });
});

describe("Hugging Face daily papers", () => {
  it("asks for the previous weekday, skipping weekends", () => {
    assert.equal(previousWeekday(new Date("2026-10-20T06:00:00Z")), "2026-10-19"); // Tue → Mon
    assert.equal(previousWeekday(new Date("2026-10-19T06:00:00Z")), "2026-10-16"); // Mon → Fri
    assert.equal(previousWeekday(new Date("2026-10-18T06:00:00Z")), "2026-10-16"); // Sun → Fri
    assert.equal(previousWeekday(new Date("2026-10-17T06:00:00Z")), "2026-10-16"); // Sat → Fri
  });

  function paper(id: string, upvotes: number): DailyPaper {
    return {
      title: `Paper ${id}`,
      paper: {
        id,
        title: `Paper ${id}`,
        summary: `The authors' abstract for ${id}. It explains the method.`,
        upvotes,
        submittedOnDailyAt: "2026-10-16T00:00:00.000Z",
      },
    };
  }

  it("keeps the top 5 by upvotes, each with at least 20", () => {
    const papers = [
      paper("a", 667),
      paper("b", 19),
      paper("c", 300),
      paper("d", 25),
      paper("e", 90),
      paper("f", 21),
      paper("g", 400),
    ];
    const kept = paperCandidates(papers, "2026-10-16", 280).map((c) => c.paper?.arxivId);
    assert.deepEqual(kept, ["a", "g", "c", "e", "d"]);
  });

  it("links the paper page and uses the authors' abstract, never the model-written summary", () => {
    const withAiSummary = { ...paper("2610.21601", 667), ai_summary: "Model-written TL;DR." };
    const [candidate] = paperCandidates(parsePapers([withAiSummary]), "2026-10-16", 280);
    assert.equal(candidate?.url, "https://huggingface.co/papers/2610.21601");
    assert.equal(
      candidate?.summary,
      "The authors' abstract for 2610.21601. It explains the method.",
    );
    assert.deepEqual(candidate?.paper, { upvotes: 667, arxivId: "2610.21601" });
    assert.deepEqual(candidate?.source, { id: "hf-papers", name: "Hugging Face Papers" });
    assert.equal(candidate?.section, "papers");
  });
});
