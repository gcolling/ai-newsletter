import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalUrl, cleanUrl, hostOf, outletOf, storyId } from "../../src/collect/url.ts";

describe("canonicalUrl", () => {
  it("lowercases the host", () => {
    assert.equal(canonicalUrl("https://Example.COM/Post"), "https://example.com/Post");
  });

  it("drops utm_*, fbclid, gclid, ref and ref_src but keeps real parameters", () => {
    assert.equal(
      canonicalUrl(
        "https://example.com/a?id=7&utm_source=rss&utm_medium=feed&fbclid=x&gclid=y&ref=hn&ref_src=twsrc",
      ),
      "https://example.com/a?id=7",
    );
  });

  it("drops the fragment and a trailing slash", () => {
    assert.equal(canonicalUrl("https://example.com/post/#comments"), "https://example.com/post");
  });

  it("keeps the slash of a root URL", () => {
    assert.equal(canonicalUrl("https://example.com/"), "https://example.com/");
  });

  it("can keep the fragment for pages where it identifies the entry", () => {
    assert.equal(
      canonicalUrl("https://developers.openai.com/codex/changelog/#github-release-1", true),
      "https://developers.openai.com/codex/changelog#github-release-1",
    );
  });
});

describe("storyId", () => {
  it("is 10 base36 characters", () => {
    assert.match(storyId("https://example.com/agents"), /^[0-9a-z]{10}$/);
  });

  it("is stable across runs (pinned value)", () => {
    assert.equal(storyId("https://example.com/agents"), "a79bmx1skm");
  });

  it("is the same for URL variants that share a canonical form", () => {
    const a = storyId(canonicalUrl("https://Example.com/agents/?utm_source=rss#top"));
    const b = storyId(canonicalUrl("https://example.com/agents"));
    assert.equal(a, b);
  });

  it("differs for different stories", () => {
    assert.notEqual(storyId("https://example.com/a"), storyId("https://example.com/b"));
  });
});

describe("cleanUrl", () => {
  it("resolves relative links against the source homepage", () => {
    assert.equal(
      cleanUrl("/blog/post", { base: "https://example.com/news/" }),
      "https://example.com/blog/post",
    );
  });

  it("rejects anything that is not http(s)", () => {
    assert.equal(cleanUrl("ftp://example.com/file"), undefined);
    assert.equal(cleanUrl("javascript:alert(1)"), undefined);
    assert.equal(cleanUrl("not a url"), undefined);
  });
});

describe("hostOf and outletOf", () => {
  it("hostOf drops a leading www.", () => {
    assert.equal(hostOf("https://www.theverge.com/ai"), "theverge.com");
  });

  it("outletOf groups subdomains of one site", () => {
    assert.equal(outletOf("https://blog.cloudflare.com/x"), "cloudflare.com");
    assert.equal(outletOf("https://www.bbc.co.uk/news"), "bbc.co.uk");
  });

  it("outletOf keeps publishers on shared hosts apart", () => {
    assert.equal(outletOf("https://importai.substack.com/p/x"), "importai.substack.com");
  });
});
