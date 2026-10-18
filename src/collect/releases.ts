import type { Source } from "../types.ts";
import type { Candidate } from "./candidate.ts";
import { htmlToBlocks, truncate } from "./text.ts";

/**
 * The tag a GitHub release entry points at. GitHub's Atom titles can hide pre-release suffixes
 * (title "v0.40.7" for tag "v0.40.7-rc0"), so the tag comes from the link, then the entry id.
 */
export function releaseTag(link: string, entryId = ""): string | undefined {
  const fromLink = /\/releases\/tag\/([^?#]+)/.exec(link)?.[1];
  const fromId = /^tag:github\.com,2008:Repository\/\d+\/(.+)$/.exec(entryId)?.[1];
  const raw = fromLink ?? fromId;
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function isExcludedTag(tag: string, source: Pick<Source, "excludeTags">): boolean {
  return source.excludeTags?.test(tag) ?? false;
}

/** "v2.4.1" → "2.4.1", "n8n@2.44.0" → "2.44.0", "2025-06-18" stays as it is. */
export function versionFromTag(tag: string): string {
  return tag.replace(/^.*@(?=v?\d)/, "").replace(/^v(?=\d)/i, "");
}

/** First version-looking token in a changelog title such as "Codex CLI Release: 0.163.0". */
export function versionFromTitle(title: string): string | undefined {
  return /\bv?(\d+\.\d+(?:\.\d+)*(?:-[\w.]+)?)\b/.exec(title)?.[1];
}

/** "Claude Code releases" → "Claude Code". */
export function productName(sourceName: string): string {
  return sourceName.replace(/\s+(?:releases|changelog)$/i, "");
}

export function releaseTitle(sourceName: string, version: string): string {
  return `${productName(sourceName)} ${version}`;
}

/** "owner/repo" from any github.com URL. */
export function repoFromUrl(url: string): string | undefined {
  const match = /github\.com\/([\w.-]+)\/([\w.-]+)/.exec(url);
  return match ? `${match[1]}/${match[2]?.replace(/\.git$/, "")}` : undefined;
}

/** The repo a release belongs to: the source's GitHub URL, else the first repo the notes link. */
export function releaseRepo(source: Pick<Source, "id" | "homepage" | "feed">, notes: string) {
  const linked = /github\.com\/[\w.-]+\/[\w.-]+\/(?:pull|issues|releases|commit)\//.exec(notes);
  return (
    repoFromUrl(source.homepage) ??
    repoFromUrl(source.feed) ??
    (linked ? repoFromUrl(linked[0]) : undefined) ??
    source.id
  );
}

const NOT_MEANINGFUL: RegExp[] = [
  /^(?:what'?s changed|what'?s new|changes|changelog|release notes|highlights|new features?|features|improvements|enhancements|bug ?fixes|fixes|breaking changes?|new contributors|contributors|other|others|misc(?:ellaneous)?|summary|overview|notes|dependencies|documentation|docs|internal|chores?|install(?:ation)?|assets|upgrading)\s*:?$/i,
  /^full changelog\b/i,
  /made (?:their|his|her) first contribution/i,
  /^v?\d+(?:\.\d+)+\S*$/,
  /^\d{4}-\d{2}-\d{2}$/,
  /^@[\w-]+$/,
];

/** Strips the PR and author credits GitHub appends to generated notes. */
export function cleanReleaseLine(line: string): string {
  return line
    .replace(/^[*•\-–]\s+/, "")
    .replace(/^#\d+\s*[-–:]?\s*/, "")
    .replace(/\s+by @[\w-]+(?:(?:,| and) @[\w-]+)* in \S+$/, "")
    .replace(/\s+in (?:#\d+|https:\/\/github\.com\/\S+)$/, "")
    .replace(/\s*\((?:#\d+(?:,\s*)?)+\)\.?$/, "")
    .replace(/\s+\(?#\d+\)?$/, "")
    .trim();
}

/** First line of the notes that says something, skipping headings like "What's Changed". */
export function releaseSummary(notesHtml: string, max: number): string {
  for (const block of htmlToBlocks(notesHtml)) {
    const line = cleanReleaseLine(block);
    if (line.length < 3 || NOT_MEANINGFUL.some((pattern) => pattern.test(line))) continue;
    return truncate(line, max);
  }
  return "";
}

/**
 * GitHub's Atom also lists plain tags that have no release, with the tagging commit message as
 * the only "notes" (opencode: "release: v2.0.32"). Those are not releases.
 */
export function isBareTag(notesHtml: string): boolean {
  const text = htmlToBlocks(notesHtml).join(" ");
  return /^(?:chore\(release\):\s*)?(?:release|version|bump(?: version)?(?: to)?)\b\s*:?\s*v?\d[\w.@+-]*$/i.test(
    text,
  );
}

/**
 * One release story per source and issue: the newest wins. Keyed by source, not repo, because a
 * changelog's repo is guessed from links in its notes and may differ from entry to entry.
 */
export function newestPerSource(candidates: Candidate[]): Candidate[] {
  const newest = new Map<string, Candidate>();
  const rest: Candidate[] = [];
  for (const c of candidates) {
    if (!c.release) {
      rest.push(c);
      continue;
    }
    const current = newest.get(c.source.id);
    if (!current || c.publishedAt > current.publishedAt) newest.set(c.source.id, c);
  }
  return [...newest.values(), ...rest];
}
