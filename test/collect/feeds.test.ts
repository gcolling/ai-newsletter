import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { entryKeys, feedCandidates, inWindow, techmemeDek } from "../../src/collect/feeds.ts";
import { hoursAgo, NOW, testSource, WINDOW } from "./helpers.ts";

const context = { window: WINDOW, now: NOW, summaryLength: 280 };

function rssItem(fields: { title: string; link: string; date?: string; description?: string }) {
  return `<item>
    <title><![CDATA[${fields.title}]]></title>
    <link>${fields.link}</link>
    ${fields.description ? `<description><![CDATA[${fields.description}]]></description>` : ""}
    ${fields.date ? `<pubDate>${fields.date}</pubDate>` : ""}
  </item>`;
}

function rss(...items: string[]): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>${items.join("")}</channel></rss>`;
}

const recent = hoursAgo(3).toUTCString();

describe("inWindow", () => {
  it("excludes the window start and includes its end", () => {
    assert.equal(inWindow(WINDOW.from, WINDOW), false);
    assert.equal(inWindow(WINDOW.to, WINDOW), true);
  });

  it("treats 00:00:00 UTC as a date-only stamp that counts for that whole day", () => {
    // The window starts 06:00 on the 17th; a post stamped "17 Oct" may have gone out at 15:00.
    assert.equal(inWindow(new Date("2026-10-17T00:00:00Z"), WINDOW), true);
    assert.equal(inWindow(new Date("2026-10-16T00:00:00Z"), WINDOW), false);
  });

  it("does not stretch real timestamps", () => {
    assert.equal(inWindow(new Date("2026-10-17T05:59:00Z"), WINDOW), false);
  });
});

describe("feedCandidates: dates and links", () => {
  it("drops items without a date and items outside the window", () => {
    const body = rss(
      rssItem({ title: "Fresh agent news", link: "https://example.com/fresh", date: recent }),
      rssItem({ title: "Undated", link: "https://example.com/undated" }),
      rssItem({ title: "Old", link: "https://example.com/old", date: hoursAgo(48).toUTCString() }),
    );
    const titles = feedCandidates(testSource(), body, context).map((c) => c.title);
    assert.deepEqual(titles, ["Fresh agent news"]);
  });

  it("clamps future dates to now and keeps the item", () => {
    const future = new Date(NOW.getTime() + 3 * 24 * 3600_000).toUTCString();
    const [item] = feedCandidates(
      testSource(),
      rss(rssItem({ title: "From the future", link: "https://example.com/f", date: future })),
      context,
    );
    assert.equal(item?.publishedAt, NOW.toISOString());
  });

  it("keeps only http(s) links and resolves relative ones", () => {
    const body = rss(
      rssItem({ title: "Relative", link: "/blog/relative", date: recent }),
      rssItem({ title: "Mail", link: "ftp://example.com/x", date: recent }),
    );
    const items = feedCandidates(
      testSource({ homepage: "https://example.com/news/" }),
      body,
      context,
    );
    assert.deepEqual(
      items.map((c) => c.url),
      ["https://example.com/blog/relative"],
    );
  });

  it("removes tracking parameters from the link and fills id and host", () => {
    const [item] = feedCandidates(
      testSource(),
      rss(
        rssItem({ title: "Post", link: "https://www.example.com/p?utm_source=rss", date: recent }),
      ),
      context,
    );
    assert.equal(item?.url, "https://www.example.com/p");
    assert.equal(item?.host, "example.com");
    assert.match(item?.id ?? "", /^[0-9a-z]{10}$/);
  });
});

describe("feedCandidates: relevance and deny list", () => {
  const body = rss(
    rssItem({
      title: "OAuth changes for Android apps",
      link: "https://example.com/oauth",
      date: recent,
    }),
    rssItem({
      title: "Gemini API adds tool calling",
      link: "https://example.com/gemini",
      date: recent,
    }),
    rssItem({
      title: "The 10 best laptops for 2026",
      link: "https://example.com/laptops",
      date: recent,
    }),
  );

  it("keyword-filtered sources keep only AI items", () => {
    const titles = feedCandidates(testSource({ keywordFilter: true }), body, context).map(
      (c) => c.title,
    );
    assert.deepEqual(titles, ["Gemini API adds tool calling"]);
  });

  it("other sources keep everything except hard-denied items", () => {
    const titles = feedCandidates(testSource(), body, context).map((c) => c.title);
    assert.deepEqual(titles, ["OAuth changes for Android apps", "Gemini API adds tool calling"]);
  });
});

describe("entryKeys", () => {
  it("drops fragments normally", () => {
    const keys = entryKeys(["https://example.com/a#x", "https://example.com/b#y"]);
    assert.deepEqual(
      keys.map((k) => k.key),
      ["https://example.com/a", "https://example.com/b"],
    );
  });

  it("keeps fragments when entries would otherwise share one URL (changelog pages)", () => {
    const keys = entryKeys([
      "https://developers.openai.com/codex/changelog/#release-2",
      "https://developers.openai.com/codex/changelog/#release-1",
    ]);
    assert.deepEqual(
      keys.map((k) => k.key),
      [
        "https://developers.openai.com/codex/changelog#release-2",
        "https://developers.openai.com/codex/changelog#release-1",
      ],
    );
  });
});

describe("Techmeme", () => {
  const description = `<A HREF="https://www.ft.com/content/abc"><IMG SRC="http://www.techmeme.com/i.jpg"></A>
    <P><A HREF="https://www.techmeme.com/261018/p6#a261018p6"><IMG SRC="pml.png"></A> Jane Doe / <A HREF="https://www.ft.com/">Financial Times</A>:<BR>
    <SPAN><B><A HREF="https://www.ft.com/content/abc">Big AI chip deal collapses</A></B></SPAN>&nbsp; &mdash;&nbsp; The first lede sentence.&nbsp; &mdash;&nbsp; A second one that gets cut &hellip; </P>`;

  it("keeps the first lede after the headline", () => {
    assert.equal(techmemeDek(description), "The first lede sentence.");
  });

  it("keeps the ellipsis when Techmeme cut the lede short", () => {
    const cut = "<P>Outlet:<BR><B>Headline</B> &mdash; A lede that stops &hellip; </P>";
    assert.equal(techmemeDek(cut), "A lede that stops…");
  });

  it("points at the original article and drops the (Author/Outlet) suffix", () => {
    const body = rss(
      rssItem({
        title: "Big AI chip deal collapses (Jane Doe/Financial Times)",
        link: "https://www.techmeme.com/261018/p6#a261018p6",
        description,
        date: recent,
      }),
    );
    const [item] = feedCandidates(
      testSource({ id: "techmeme", keywordFilter: true }),
      body,
      context,
    );
    assert.equal(item?.title, "Big AI chip deal collapses");
    assert.equal(item?.url, "https://www.ft.com/content/abc");
    assert.equal(item?.host, "ft.com");
    assert.equal(item?.summary, "The first lede sentence.");
  });
});
