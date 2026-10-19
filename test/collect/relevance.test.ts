import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDenied,
  isRelevant,
  isRelevantTitle,
  strongMatches,
  weakMatches,
} from "../../src/collect/relevance.ts";

describe("isRelevant: include rule (one strong term, or two different weak terms)", () => {
  it("keeps an item with one strong term", () => {
    assert.equal(isRelevant("OpenAI ships a new browser", ""), true);
  });

  it("keeps an item with two different weak terms", () => {
    assert.equal(isRelevant("A new benchmark for inference hardware", ""), true);
  });

  it("drops an item with a single weak term", () => {
    assert.equal(isRelevant("Ten classic models of the Porsche 911", ""), false);
  });

  it("counts plural and singular as the same weak term", () => {
    assert.equal(isRelevant("One model, two models, three models", ""), false);
  });

  it("looks at the start of the summary too", () => {
    assert.equal(isRelevant("What we learned this quarter", "Mostly about LLM evals."), true);
  });
});

describe("case-sensitive terms", () => {
  it('"AI" only counts in capitals', () => {
    assert.equal(isRelevant("The AI boom", ""), true);
    assert.equal(isRelevant("Visit Ai Weiwei's new show", ""), false);
  });

  it('"RAG" counts, the word "rag" does not', () => {
    assert.equal(isRelevant("RAG pipelines in practice", ""), true);
    assert.equal(isRelevant("A rag and bone shop", ""), false);
  });

  it('"Grok" the model counts, "grok" the verb does not', () => {
    assert.equal(isRelevant("Grok 5 is out", ""), true);
    assert.equal(isRelevant("How to grok a codebase quickly", ""), false);
  });
});

describe("collisions neutralise only the term they collide with", () => {
  it("Jean-Claude is not Claude", () => {
    assert.equal(isRelevant("Jean-Claude Van Damme returns to the screen", ""), false);
  });

  it("Gemini in a horoscope context is not the model", () => {
    assert.equal(isRelevant("Gemini season: what your zodiac sign says about you", ""), false);
  });

  it("a real estate agent is not an AI agent", () => {
    assert.equal(isRelevant("Real estate agents rethink their workflow", ""), false);
  });

  it("a Tesla Model 3 is not a model", () => {
    assert.equal(isRelevant("Tesla Model 3 recall over a safety issue", ""), false);
  });

  it("Microsoft Certified Professional is not MCP", () => {
    assert.equal(isRelevant("Microsoft Certified Professional (MCP) exam changes", ""), false);
  });

  it("Google Quantum AI is quantum computing, not AI", () => {
    assert.equal(isRelevant("Willow chip result", "Shown on Google Quantum AI hardware."), false);
  });

  it("the rest of the text still counts", () => {
    assert.equal(isRelevant("Real estate agents are now using ChatGPT", ""), true);
  });
});

describe("isRelevantTitle (Hacker News rule: the title alone must pass)", () => {
  it("keeps a strong term in the title", () => {
    assert.equal(isRelevantTitle("Show HN: An LLM-powered terminal"), true);
  });

  it("keeps two weak terms in the title", () => {
    assert.equal(isRelevantTitle("Agents need better benchmarks"), true);
  });

  it("drops a title with one weak term", () => {
    assert.equal(isRelevantTitle("My new GPU arrived"), false);
  });
});

describe("matches report the words as written", () => {
  it("returns distinct strong terms in order of appearance", () => {
    const texts = strongMatches("Building agentic apps with MCP and agentic loops").map(
      (m) => m.text,
    );
    assert.deepEqual(texts, ["agentic", "MCP"]);
  });

  it("flags generic terms so reasons can skip them", () => {
    const [match] = strongMatches("The AI boom");
    assert.equal(match?.generic, true);
  });

  it("finds weak terms", () => {
    assert.deepEqual(
      weakMatches("Inference chips and data centers").map((m) => m.id),
      ["inference", "chip", "data center"],
    );
  });
});

describe("isDenied: hard drops for any source", () => {
  it("drops listicles", () => {
    assert.equal(isDenied("The 12 best AI tools for 2026", ""), true);
    assert.equal(isDenied("12 Best Enterprise Workflow Automation Platforms", ""), true);
    assert.equal(isDenied("IT Automation Software: 6 Tools for Different IT Jobs", ""), true);
  });

  it("drops shopping deals", () => {
    assert.equal(isDenied("The best Prime Day deals on AI gadgets", ""), true);
    assert.equal(isDenied("Save $50 off this AI pin today", ""), true);
  });

  it("keeps news that merely mentions a deal", () => {
    assert.equal(
      isDenied("Anthropic consults law firms before AI agents start cutting deals", ""),
      false,
    );
    assert.equal(isDenied("Microsoft cancels its deal to rent Nvidia AI chips", ""), false);
  });

  it("drops consumer gaming posts, even when only the summary says so", () => {
    assert.equal(
      isDenied("Dial Up the Cloud: DLSS 4.5 Arrives", "Now streaming on GeForce NOW."),
      true,
    );
  });

  it("drops sponsored posts flagged at the start of the summary", () => {
    assert.equal(isDenied("The price of not building fast enough", "SPONSORED POST: As AI…"), true);
  });

  it("drops horoscopes", () => {
    assert.equal(isDenied("Your Gemini horoscope for October", ""), true);
  });
});
