import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { feedCandidates } from "../../src/collect/feeds.ts";
import {
  cleanReleaseLine,
  isBareTag,
  isExcludedTag,
  newestPerSource,
  releaseSummary,
  releaseTag,
  releaseTitle,
  versionFromTag,
  versionFromTitle,
} from "../../src/collect/releases.ts";
import { sources } from "../../src/sources.ts";
import type { Source } from "../../src/types.ts";
import { hoursAgo, NOW, story, WINDOW } from "./helpers.ts";

/** The real entries from src/sources.ts, so these tests also guard the configured patterns. */
function configured(id: string): Source {
  const source = sources.find((s) => s.id === id);
  if (!source) throw new Error(`no source ${id}`);
  return source;
}

describe("releaseTag: the tag comes from the link, never the title", () => {
  it("reads the tag from /releases/tag/<tag>", () => {
    assert.equal(
      releaseTag("https://github.com/ollama/ollama/releases/tag/v0.40.7-rc0"),
      "v0.40.7-rc0",
    );
  });

  it("decodes %40-encoded tags", () => {
    assert.equal(
      releaseTag("https://github.com/n8n-io/n8n/releases/tag/n8n%402.44.0"),
      "n8n@2.44.0",
    );
    assert.equal(
      releaseTag(
        "https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/%40modelcontextprotocol%2Fserver%402.3.1",
      ),
      "@modelcontextprotocol/server@2.3.1",
    );
  });

  it("falls back to the Atom entry id", () => {
    assert.equal(
      releaseTag("https://github.com/x/y", "tag:github.com,2008:Repository/1/v1.2.3"),
      "v1.2.3",
    );
  });
});

describe("configured excludeTags", () => {
  it("ollama: hides release candidates", () => {
    const ollama = configured("gh-ollama");
    assert.equal(isExcludedTag("v0.40.7-rc0", ollama), true);
    assert.equal(isExcludedTag("v0.40.6", ollama), false);
  });

  it("n8n: keeps minor releases only, not patches or moving tags", () => {
    const n8n = configured("gh-n8n");
    assert.equal(isExcludedTag("n8n@2.44.0", n8n), false);
    assert.equal(isExcludedTag("n8n@2.44.3", n8n), true);
    assert.equal(isExcludedTag("stable", n8n), true);
    assert.equal(isExcludedTag("beta", n8n), true);
  });

  it("gemini-cli: hides nightlies and previews", () => {
    const gemini = configured("gh-gemini-cli");
    assert.equal(isExcludedTag("v0.66.0-nightly.20261018.ged96faedf", gemini), true);
    assert.equal(isExcludedTag("v0.66.0-preview.1", gemini), true);
    assert.equal(isExcludedTag("v0.65.0", gemini), false);
  });

  it("MCP TypeScript SDK: hides per-package tags once decoded", () => {
    const sdk = configured("gh-mcp-typescript-sdk");
    assert.equal(isExcludedTag("@modelcontextprotocol/server@2.3.1", sdk), true);
    assert.equal(isExcludedTag("v2.3.1", sdk), false);
  });
});

describe("version and title", () => {
  it("strips a leading v and a package prefix from the tag", () => {
    assert.equal(versionFromTag("v2.4.1"), "2.4.1");
    assert.equal(versionFromTag("n8n@2.44.0"), "2.44.0");
    assert.equal(versionFromTag("2025-06-18"), "2025-06-18");
  });

  it('names the release after the product: "Claude Code 2.4.1"', () => {
    assert.equal(releaseTitle("Claude Code releases", "2.4.1"), "Claude Code 2.4.1");
    assert.equal(releaseTitle("OpenAI Codex changelog", "0.163.0"), "OpenAI Codex 0.163.0");
  });

  it("finds the version in a changelog entry title", () => {
    assert.equal(versionFromTitle("Codex CLI Release: 0.163.0"), "0.163.0");
    assert.equal(versionFromTitle("Codex app"), undefined);
  });
});

describe("releaseSummary: first meaningful line of the notes", () => {
  it('skips headings like "What\'s Changed" and drops PR credits', () => {
    const notes = `<h2>What's Changed</h2><ul>
      <li>Faster model loading by <a href="https://github.com/someone">@someone</a> in <a href="https://github.com/ollama/ollama/pull/1">#1</a></li>
      <li>Second change</li></ul>`;
    assert.equal(releaseSummary(notes, 280), "Faster model loading");
  });

  it('skips "Full Changelog" lines', () => {
    const notes = "<p><strong>Full Changelog</strong>: v1...v2</p><p>Real note.</p>";
    assert.equal(releaseSummary(notes, 280), "Real note.");
  });

  it("strips trailing issue references", () => {
    assert.equal(
      cleanReleaseLine("- Open /config to search settings. (#52990, #53429)"),
      "Open /config to search settings.",
    );
  });
});

describe("isBareTag", () => {
  it("spots a plain tag whose only notes are the release commit", () => {
    assert.equal(isBareTag("<p>release: v2.0.32</p>"), true);
  });

  it("does not flag real notes", () => {
    assert.equal(isBareTag("<ul><li>Configure model reasoning options</li></ul>"), false);
  });
});

describe("newestPerSource", () => {
  it("keeps only the newest release of each source", () => {
    const older = story({
      title: "Claude Code 2.1.301",
      publishedAt: hoursAgo(10),
      release: { repo: "anthropics/claude-code", version: "2.1.301" },
    });
    const newer = story({
      title: "Claude Code 2.1.302",
      publishedAt: hoursAgo(2),
      release: { repo: "anthropics/claude-code", version: "2.1.302" },
    });
    const other = story({
      sourceId: "gh-ollama",
      title: "Ollama 0.40.6",
      release: { repo: "ollama/ollama", version: "0.40.6" },
    });
    const kept = newestPerSource([older, newer, other]).map((c) => c.title);
    assert.deepEqual(kept.sort(), ["Claude Code 2.1.302", "Ollama 0.40.6"]);
  });
});

describe("release feeds end to end", () => {
  const context = { window: WINDOW, now: NOW, summaryLength: 280 };

  it("drops an rc hidden behind a clean title and keeps the newest real release", () => {
    const atom = `<feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>tag:github.com,2008:Repository/1/v0.40.7-rc0</id>
        <updated>2026-10-18T00:28:57Z</updated>
        <link rel="alternate" href="https://github.com/ollama/ollama/releases/tag/v0.40.7-rc0"/>
        <title>v0.40.7</title>
        <content type="html">&lt;ul&gt;&lt;li&gt;Release candidate&lt;/li&gt;&lt;/ul&gt;</content>
      </entry>
      <entry>
        <id>tag:github.com,2008:Repository/1/v0.40.6</id>
        <updated>2026-10-17T15:29:04Z</updated>
        <link rel="alternate" href="https://github.com/ollama/ollama/releases/tag/v0.40.6"/>
        <title>v0.40.6</title>
        <content type="html">&lt;h2&gt;What's Changed&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;win: prevent orphaned runners&lt;/li&gt;&lt;/ul&gt;</content>
      </entry>
      <entry>
        <id>tag:github.com,2008:Repository/1/v0.40.5</id>
        <updated>2026-10-17T09:00:00Z</updated>
        <link rel="alternate" href="https://github.com/ollama/ollama/releases/tag/v0.40.5"/>
        <title>v0.40.5</title>
        <content type="html">&lt;p&gt;Older fix&lt;/p&gt;</content>
      </entry>
    </feed>`;
    const [only, ...rest] = feedCandidates(configured("gh-ollama"), atom, context);
    assert.equal(rest.length, 0);
    assert.equal(only?.title, "Ollama 0.40.6");
    assert.deepEqual(only?.release, { repo: "ollama/ollama", version: "0.40.6" });
    assert.equal(only?.summary, "win: prevent orphaned runners");
  });

  it("treats the Codex changelog RSS as releases, reading the version from the item", () => {
    const rss = `<rss><channel>
      <item>
        <title>Codex CLI Release: 0.163.0</title>
        <link>https://developers.openai.com/codex/changelog/#github-release-414286110</link>
        <description>0.163.0</description>
        <content:encoded><![CDATA[<h2>New Features</h2><ul><li>Open /config to search preferences. (<a href="https://github.com/openai/codex/pull/52990">#52990</a>)</li></ul>]]></content:encoded>
        <pubDate>Sat, 17 Oct 2026 00:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Codex CLI Release: 0.162.1</title>
        <link>https://developers.openai.com/codex/changelog/#github-release-408271623</link>
        <pubDate>Fri, 09 Oct 2026 00:00:00 GMT</pubDate>
      </item>
    </channel></rss>`;
    const [codex, ...rest] = feedCandidates(configured("openai-codex-changelog"), rss, context);
    assert.equal(rest.length, 0);
    assert.equal(codex?.title, "Codex CLI 0.163.0");
    assert.deepEqual(codex?.release, { repo: "openai/codex", version: "0.163.0" });
    assert.equal(codex?.summary, "Open /config to search preferences.");
    // Every entry shares one page, so the fragment is what tells them apart.
    assert.equal(
      codex?.url,
      "https://developers.openai.com/codex/changelog/#github-release-414286110",
    );
  });
});

describe("newestPerSource with changelog repos", () => {
  it("collapses a changelog whose entries link different repos", () => {
    const a = story({ title: "Codex 0.1", release: { repo: "openai/codex", version: "0.1" } });
    const b = story({
      title: "Codex 0.2",
      publishedAt: hoursAgo(1),
      release: { repo: "some/dependency", version: "0.2" },
    });
    assert.deepEqual(
      newestPerSource([a, b]).map((c) => c.title),
      ["Codex 0.2"],
    );
  });
});
