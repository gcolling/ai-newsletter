import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachDiscussions,
  clusterStories,
  similarTitles,
  titleTokens,
} from "../../src/collect/cluster.ts";
import { hoursAgo, story } from "./helpers.ts";

const hnDiscussion = {
  site: "Hacker News" as const,
  url: "https://news.ycombinator.com/item?id=1",
  points: 412,
  comments: 230,
};

describe("titleTokens", () => {
  it("lowercases, strips punctuation and stopwords, and folds plurals", () => {
    assert.deepEqual(
      [...titleTokens("OpenAI's new GPT-6.1 model: faster, cheaper agents")],
      ["openai", "gpt", "6.1", "model", "faster", "cheaper", "agent"],
    );
  });
});

describe("similarTitles", () => {
  it("matches two outlets' headlines for the same launch", () => {
    assert.equal(
      similarTitles(
        "OpenAI launches GPT-6 with a million-token context window",
        "GPT-6 launches at OpenAI with million-token context window",
      ),
      true,
    );
  });

  it("needs at least three shared content words", () => {
    assert.equal(similarTitles("OpenAI Codex", "OpenAI Codex"), false);
  });

  it("does not match headlines that only share a company name", () => {
    assert.equal(
      similarTitles("Anthropic raises prices for Claude", "Anthropic opens an office in Tokyo"),
      false,
    );
  });

  it("matches different tenses and wordings of the same headline", () => {
    assert.equal(
      similarTitles(
        "Sources: Anthropic is consulting law firms on deal negotiation tactics as it develops AI agents to negotiate on humans' behalf and interact with AI counterparts",
        "Anthropic consults law firms to set fair negotiation norms before AI agents start cutting deals",
      ),
      true,
    );
    assert.equal(
      similarTitles(
        "Disney agrees to hire the majority of Character.AI’s workforce",
        "Filing: Disney agreed to hire 60+ staff from Character.AI and pay them for a year",
      ),
      true,
    );
  });

  it("keeps apart two stories that share only the company and 'AI agents'", () => {
    assert.equal(
      similarTitles(
        "Anthropic consults law firms to set fair negotiation norms before AI agents strike deals",
        "Anthropic has nearly stopped hiring junior staff because AI agents now do the work",
      ),
      false,
    );
  });

  it("matches a short headline contained in a longer, padded one", () => {
    assert.equal(
      similarTitles(
        "Meta launches Muse Spark, its first model built for Apple silicon Macs",
        "Meta’s Muse Spark model now runs on Macs",
      ),
      true,
    );
  });
});

describe("clusterStories", () => {
  it("merges two outlets covering the same story into one, with the other in `also`", () => {
    const verge = story({
      title: "OpenAI launches GPT-6 with a million-token context window",
      sourceName: "The Verge",
      weight: 2,
      summary: "The new model is here.",
      url: "https://www.theverge.com/gpt-6",
    });
    const decoder = story({
      title: "GPT-6 launches at OpenAI with million-token context window",
      sourceName: "The Decoder",
      weight: 1,
      url: "https://the-decoder.com/gpt-6",
    });

    const merged = clusterStories([decoder, verge]);

    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.source.name, "The Verge", "the higher-weight source represents it");
    assert.deepEqual(merged[0]?.also, [
      {
        source: "The Decoder",
        title: "GPT-6 launches at OpenAI with million-token context window",
        url: "https://the-decoder.com/gpt-6",
      },
    ]);
    assert.equal(merged[0]?.outlets, 2);
  });

  it("merges stories with the same canonical URL whatever their titles", () => {
    const a = story({ title: "Something", url: "https://example.com/post?utm_source=rss" });
    const b = story({ title: "Totally different words", url: "https://example.com/post/" });
    assert.equal(clusterStories([a, b]).length, 1);
  });

  it("prefers a summary, then the earliest, when weights tie", () => {
    const late = story({
      title: "Same story told by A today",
      summary: "Has one",
      publishedAt: hoursAgo(1),
    });
    const early = story({ title: "Same story told by B today", publishedAt: hoursAgo(9) });
    const [rep] = clusterStories([early, late]);
    assert.equal(rep?.summary, "Has one");
  });

  it("never clusters releases or papers", () => {
    const releaseA = story({
      title: "Claude Code 2.1.302 release notes",
      section: "releases",
      release: { repo: "anthropics/claude-code", version: "2.1.302" },
    });
    const releaseB = story({
      title: "Claude Code 2.1.302 release notes",
      section: "releases",
      release: { repo: "anthropics/claude-code", version: "2.1.302" },
    });
    assert.equal(clusterStories([releaseA, releaseB]).length, 2);
  });

  it("turns a forum post about the same story into the story's discussion, not an outlet", () => {
    const article = story({
      title: "OpenAI launches GPT-6 with a million-token context window",
      sourceName: "The Verge",
    });
    const hn = story({
      title: "GPT-6 launches at OpenAI with million-token context window",
      section: "community",
      sourceName: "Hacker News",
      weight: 1,
      url: "https://openai.com/index/gpt-6",
      discussion: hnDiscussion,
    });

    const [merged, ...rest] = clusterStories([hn, article]);

    assert.equal(rest.length, 0);
    assert.equal(merged?.source.name, "The Verge");
    assert.deepEqual(merged?.discussion, hnDiscussion);
    assert.equal(merged?.outlets, 1);
    assert.equal(merged?.also[0]?.source, "openai.com", "credited to the site it links to");
  });
});

describe("attachDiscussions", () => {
  it("attaches a Hacker News thread to the feed story it links to", () => {
    const article = story({ title: "A post", url: "https://example.com/post" });
    const hn = story({
      title: "A post (HN)",
      section: "community",
      url: "https://example.com/post/?utm_source=hn",
      discussion: hnDiscussion,
    });

    const unmatched = attachDiscussions([article], [hn]);

    assert.equal(unmatched.length, 0);
    assert.deepEqual(article.discussion, hnDiscussion);
  });

  it("returns posts that link to nothing we have", () => {
    const article = story({ title: "A post", url: "https://example.com/post" });
    const hn = story({
      title: "Something else",
      section: "community",
      url: "https://elsewhere.dev/",
      discussion: hnDiscussion,
    });
    assert.deepEqual(attachDiscussions([article], [hn]), [hn]);
  });

  it("keeps the livelier discussion when two forums link the same story", () => {
    const article = story({ title: "A post", url: "https://example.com/post" });
    const quiet = {
      site: "Lobsters" as const,
      url: "https://lobste.rs/s/x",
      points: 12,
      comments: 3,
    };
    const lobsters = story({
      title: "A post",
      section: "community",
      url: article.url,
      discussion: quiet,
    });
    const hn = story({
      title: "A post",
      section: "community",
      url: article.url,
      discussion: hnDiscussion,
    });

    attachDiscussions([article], [lobsters, hn]);

    assert.equal(article.discussion?.site, "Hacker News");
  });
});
