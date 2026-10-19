import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyTopic, topicScores } from "../../src/collect/classify.ts";

describe("classifyTopic", () => {
  it("uses the topic pinned by the source", () => {
    const topic = classifyTopic(
      { title: "NVIDIA ships a GPU", summary: "", section: "labs" },
      "tools",
    );
    assert.equal(topic, "tools");
  });

  it("puts papers in research whatever they say", () => {
    const topic = classifyTopic({ title: "An agent framework", summary: "", section: "papers" });
    assert.equal(topic, "research");
  });

  it("picks the topic with the most keyword hits", () => {
    const topic = classifyTopic({
      title: "NVIDIA unveils a GPU built for inference",
      summary: "",
      section: "news",
    });
    assert.equal(topic, "infra");
  });

  it("counts a title hit double and a summary hit once", () => {
    const scores = topicScores({ title: "Lawsuit", summary: "about copyright", section: "news" });
    assert.equal(scores.get("policy"), 3);
  });

  it("breaks a tie in favour of the section's default topic", () => {
    // policy ("sued") and industry ("startup") both score 2; news defaults to industry.
    const topic = classifyTopic({
      title: "Startup sued over chatbot",
      summary: "",
      section: "news",
    });
    assert.equal(topic, "industry");
  });

  it("otherwise breaks a tie by the order of src/topics.ts", () => {
    // Essays default to tools, which is not in the tie; policy is listed before industry.
    const topic = classifyTopic({
      title: "Startup sued over chatbot",
      summary: "",
      section: "essays",
    });
    assert.equal(topic, "policy");
  });

  it("falls back to the section's default topic when nothing matches", () => {
    const topic = classifyTopic({ title: "Hello world", summary: "", section: "community" });
    assert.equal(topic, "tools");
  });
});
