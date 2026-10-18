import type { Source } from "../types.ts";
import { type Candidate, makeCandidate } from "./candidate.ts";
import { type FeedEntry, parseDate, parseFeed } from "./parse.ts";
import type { Window } from "./rank.ts";
import {
  isBareTag,
  isExcludedTag,
  newestPerSource,
  releaseRepo,
  releaseSummary,
  releaseTag,
  releaseTitle,
  versionFromTag,
  versionFromTitle,
} from "./releases.ts";
import { isDenied, isRelevant } from "./relevance.ts";
import { htmlToBlocks, htmlToText, makeSummary, truncate } from "./text.ts";
import { canonicalUrl, cleanUrl, parseHttpUrl } from "./url.ts";

export interface FeedContext {
  window: Window;
  now: Date;
  summaryLength: number;
}

const DAY = 24 * 3600_000;

/**
 * Inside (from, to]. A date at exactly 00:00:00 UTC is a date-only stamp: the post appeared some
 * time that day, so it counts if any part of that day overlaps the window. Dedupe against earlier
 * issues stops it from showing up twice.
 */
export function inWindow(date: Date, window: Window): boolean {
  const time = date.getTime();
  if (time > window.to.getTime()) return false;
  const dateOnly = time % DAY === 0;
  return (dateOnly ? time + DAY : time) > window.from.getTime();
}

/**
 * Canonical key per entry. Some changelogs give every entry the same page plus a different
 * fragment; there, and only there, the fragment is what identifies the entry.
 */
export function entryKeys(links: string[]): { key: string; keepFragment: boolean }[] {
  const plain = links.map((link) => canonicalUrl(link));
  const counts = new Map<string, number>();
  for (const key of plain) counts.set(key, (counts.get(key) ?? 0) + 1);
  return links.map((link, i) => {
    const key = plain[i] ?? link;
    const shared = (counts.get(key) ?? 0) > 1;
    return { key: shared ? canonicalUrl(link, true) : key, keepFragment: shared };
  });
}

interface Prepared {
  entry: FeedEntry;
  url: string;
  key: string;
  publishedAt: Date;
}

function releaseCandidate(source: Source, p: Prepared, summaryLength: number) {
  const notes = p.entry.content || p.entry.summary;
  const tag = releaseTag(p.url, p.entry.id);
  if (tag !== undefined) {
    if (isExcludedTag(tag, source) || isBareTag(notes)) return undefined;
    const version = versionFromTag(tag);
    return makeCandidate({
      origin: source,
      title: releaseTitle(source.name, version),
      url: p.url,
      key: p.key,
      summary: releaseSummary(notes, summaryLength),
      publishedAt: p.publishedAt,
      release: { repo: releaseRepo(source, notes), version },
    });
  }
  // A changelog feed rather than GitHub releases: the entry itself names the version, if any.
  const title = htmlToText(p.entry.title).replace(/\s+Release:\s+/i, " ");
  const version = versionFromTitle(title);
  if (!title || (version && isExcludedTag(version, source))) return undefined;
  const candidate = makeCandidate({
    origin: source,
    title,
    url: p.url,
    key: p.key,
    summary: releaseSummary(notes, summaryLength),
    publishedAt: p.publishedAt,
  });
  if (version) candidate.release = { repo: releaseRepo(source, notes), version };
  return candidate;
}

/**
 * Techmeme descriptions read "Author / Outlet: Headline — lede — more lede …". Returns the first
 * lede, keeping a trailing "…" when Techmeme cut it short.
 */
export function techmemeDek(description: string): string {
  const block = htmlToBlocks(description).find((b) => b.includes(" — "));
  const match = block && /\s—\s+(.+?)(\s+—\s|\s*…|$)/.exec(block);
  if (!match?.[1]) return "";
  return match[2]?.trim() === "…" ? `${match[1]}…` : match[1];
}

/**
 * Techmeme links to its own permalink and appends "(Author/Outlet)" to titles. Point at the
 * original article and keep the lede that follows the headline.
 */
function techmemeCandidate(source: Source, p: Prepared, summaryLength: number) {
  const description = p.entry.summary;
  const original = [...description.matchAll(/href="([^"]+)"/gi)]
    .map((m) => cleanUrl(m[1] ?? ""))
    .find((href) => href && !/(^|\.)techmeme\.com$/.test(parseHttpUrl(href)?.hostname ?? ""));
  const title = htmlToText(p.entry.title).replace(/\s*\([^()]*\)\s*$/, "");
  const dek = techmemeDek(description);
  return makeCandidate({
    origin: source,
    title,
    url: original ?? p.url,
    key: original ? canonicalUrl(original) : p.key,
    summary: dek
      ? truncate(dek, summaryLength)
      : makeSummary(title, description, "", summaryLength),
    publishedAt: p.publishedAt,
  });
}

function articleCandidate(source: Source, p: Prepared, summaryLength: number) {
  if (source.id === "techmeme") return techmemeCandidate(source, p, summaryLength);
  const title = htmlToText(p.entry.title);
  if (!title) return undefined;
  return makeCandidate({
    origin: source,
    title,
    url: p.url,
    key: p.key,
    summary: makeSummary(title, p.entry.summary, p.entry.content, summaryLength),
    publishedAt: p.publishedAt,
  });
}

/** Keeps entries with an http(s) link and a valid date inside the window. */
function prepare(source: Source, entries: FeedEntry[], context: FeedContext): Prepared[] {
  const links = entries.map((e) => cleanUrl(e.link, { base: source.homepage, keepFragment: true }));
  const keys = entryKeys(links.map((link) => link ?? ""));
  return entries.flatMap((entry, i) => {
    const link = links[i];
    const keyInfo = keys[i];
    const date = parseDate(entry.date);
    if (!link || !keyInfo || !date) return [];
    const publishedAt = date > context.now ? context.now : date;
    if (!inWindow(publishedAt, context.window)) return [];
    const url = keyInfo.keepFragment ? link : (cleanUrl(link) ?? link);
    return [{ entry, url, key: keyInfo.key, publishedAt }];
  });
}

/** Turns one feed body into candidates: window, release rules, relevance and the deny list. */
export function feedCandidates(source: Source, body: string, context: FeedContext): Candidate[] {
  const prepared = prepare(source, parseFeed(body), context);
  const build = source.section === "releases" ? releaseCandidate : articleCandidate;
  const candidates = prepared.flatMap((p) => build(source, p, context.summaryLength) ?? []);
  const kept = candidates.filter((c) => {
    if (isDenied(c.title, c.summary)) return false;
    return !source.keywordFilter || isRelevant(c.title, c.summary);
  });
  return source.section === "releases" ? newestPerSource(kept) : kept;
}
