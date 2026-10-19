import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseDate, parseFeed } from "../../src/collect/parse.ts";
import { htmlToText } from "../../src/collect/text.ts";

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Example blog</title>
  <item>
    <title><![CDATA[Agents & tools: a <em>field</em> guide]]></title>
    <link>https://example.com/agents?utm_source=rss</link>
    <description><![CDATA[<p>How teams ship agents.</p>]]></description>
    <content:encoded><![CDATA[<p>The full post.</p>]]></content:encoded>
    <pubDate>Sat, 17 Oct 2026 14:30:00 +0000</pubDate>
    <guid isPermaLink="false">post-1</guid>
  </item>
  <item>
    <title>Fable &amp;amp; The End of the Free Lunch</title>
    <link>https://example.com/fable</link>
    <description>It&#8217;s &lt;b&gt;escaped&lt;/b&gt; HTML</description>
    <dc:date>2026-10-17T09:00:00Z</dc:date>
  </item>
  <item>
    <title>A post without a date</title>
    <link>https://example.com/undated</link>
  </item>
</channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Release notes from ollama</title>
  <entry>
    <id>tag:github.com,2008:Repository/658928958/v0.40.7-rc0</id>
    <updated>2026-10-18T00:28:57Z</updated>
    <link rel="replies" href="https://example.com/comments"/>
    <link rel="alternate" type="text/html" href="https://github.com/ollama/ollama/releases/tag/v0.40.7-rc0"/>
    <title>v0.40.7</title>
    <content type="html">&lt;h2&gt;What&#39;s Changed&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Faster model loading&lt;/li&gt;&lt;/ul&gt;</content>
  </entry>
  <entry>
    <id>urn:example:2</id>
    <title type="html">Context &amp;amp; memory</title>
    <link href="https://example.com/context"/>
    <published>2026-10-17T10:00:00-04:00</published>
    <updated>2026-10-18T10:00:00Z</updated>
    <summary type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Inline <b>XHTML</b> text</p></div></summary>
  </entry>
</feed>`;

describe("parseFeed: RSS 2.0", () => {
  const entries = parseFeed(RSS);

  it("returns one entry per <item>", () => {
    assert.equal(entries.length, 3);
  });

  it("reads link, guid, description, content:encoded and pubDate", () => {
    const [first] = entries;
    assert.equal(first?.link, "https://example.com/agents?utm_source=rss");
    assert.equal(first?.id, "post-1");
    assert.equal(first?.summary, "<p>How teams ship agents.</p>");
    assert.equal(first?.content, "<p>The full post.</p>");
    assert.equal(first?.date, "Sat, 17 Oct 2026 14:30:00 +0000");
  });

  it("keeps CDATA as-is, so tags inside it can be stripped later", () => {
    assert.equal(entries[0]?.title, "Agents & tools: a <em>field</em> guide");
    assert.equal(htmlToText(entries[0]?.title ?? ""), "Agents & tools: a field guide");
  });

  it("decodes a double-encoded title down to a single &", () => {
    assert.equal(htmlToText(entries[1]?.title ?? ""), "Fable & The End of the Free Lunch");
  });

  it("decodes numeric entities and escaped markup in descriptions", () => {
    assert.equal(htmlToText(entries[1]?.summary ?? ""), "It’s escaped HTML");
  });

  it("falls back to dc:date when there is no pubDate", () => {
    assert.equal(entries[1]?.date, "2026-10-17T09:00:00Z");
  });

  it("reports a missing date as an empty string", () => {
    assert.equal(entries[2]?.date, "");
    assert.equal(parseDate(entries[2]?.date ?? ""), undefined);
  });

  it("handles a channel with a single item (no array)", () => {
    const single = parseFeed(
      "<rss><channel><item><title>Only one</title><link>https://example.com/1</link></item></channel></rss>",
    );
    assert.equal(single.length, 1);
    assert.equal(single[0]?.title, "Only one");
  });

  it("keeps numeric-looking titles as text", () => {
    const [entry] = parseFeed(
      "<rss><channel><item><title>2025</title><link>https://example.com/y</link></item></channel></rss>",
    );
    assert.equal(entry?.title, "2025");
  });
});

describe("parseFeed: Atom", () => {
  const entries = parseFeed(ATOM);

  it("returns one entry per <entry>", () => {
    assert.equal(entries.length, 2);
  });

  it("prefers the rel=alternate link over other links", () => {
    assert.equal(entries[0]?.link, "https://github.com/ollama/ollama/releases/tag/v0.40.7-rc0");
  });

  it("uses a link without rel when there is no alternate", () => {
    assert.equal(entries[1]?.link, "https://example.com/context");
  });

  it("reads the entry id and html content", () => {
    assert.equal(entries[0]?.id, "tag:github.com,2008:Repository/658928958/v0.40.7-rc0");
    assert.equal(htmlToText(entries[0]?.content ?? ""), "What's Changed Faster model loading");
  });

  it("uses published before updated, and updated when that is all there is", () => {
    assert.equal(entries[1]?.date, "2026-10-17T10:00:00-04:00");
    assert.equal(entries[0]?.date, "2026-10-18T00:28:57Z");
  });

  it("decodes html-typed titles and keeps inline XHTML summaries", () => {
    assert.equal(htmlToText(entries[1]?.title ?? ""), "Context & memory");
    assert.equal(htmlToText(entries[1]?.summary ?? ""), "Inline XHTML text");
  });
});

describe("parseFeed: not a feed", () => {
  it("throws on an HTML page (a bot challenge or an error page)", () => {
    assert.throws(
      () => parseFeed("<html><body>Just a moment…</body></html>"),
      /not an RSS or Atom/,
    );
  });
});

describe("parseDate", () => {
  it("parses RFC 822 dates with offsets", () => {
    assert.equal(
      parseDate("Sun, 18 Oct 2026 07:15:00 -0400")?.toISOString(),
      "2026-10-18T11:15:00.000Z",
    );
  });

  it("parses ISO 8601 dates", () => {
    assert.equal(parseDate("2026-10-17T10:00:00-04:00")?.toISOString(), "2026-10-17T14:00:00.000Z");
  });

  it("returns undefined for garbage", () => {
    assert.equal(parseDate("yesterday-ish"), undefined);
  });
});
