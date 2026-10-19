const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  shy: "",
  zwj: "",
  zwnj: "",
  ndash: "–",
  mdash: "—",
  minus: "−",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  sbquo: "‚",
  ldquo: "“",
  rdquo: "”",
  bdquo: "„",
  laquo: "«",
  raquo: "»",
  lsaquo: "‹",
  rsaquo: "›",
  prime: "′",
  Prime: "″",
  middot: "·",
  bull: "•",
  dagger: "†",
  Dagger: "‡",
  sect: "§",
  para: "¶",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  times: "×",
  divide: "÷",
  plusmn: "±",
  micro: "µ",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  sup2: "²",
  sup3: "³",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  iexcl: "¡",
  iquest: "¿",
  larr: "←",
  rarr: "→",
  uarr: "↑",
  darr: "↓",
  harr: "↔",
  rArr: "⇒",
  check: "✓",
  hearts: "♥",
  aacute: "á",
  agrave: "à",
  acirc: "â",
  auml: "ä",
  aring: "å",
  atilde: "ã",
  aelig: "æ",
  ccedil: "ç",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  iacute: "í",
  igrave: "ì",
  icirc: "î",
  iuml: "ï",
  ntilde: "ñ",
  oacute: "ó",
  ograve: "ò",
  ocirc: "ô",
  ouml: "ö",
  otilde: "õ",
  oslash: "ø",
  uacute: "ú",
  ugrave: "ù",
  ucirc: "û",
  uuml: "ü",
  yacute: "ý",
  szlig: "ß",
  Aacute: "Á",
  Auml: "Ä",
  Eacute: "É",
  Ouml: "Ö",
  Uuml: "Ü",
};

const ENTITY = /&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});/gi;

/** Decodes named and numeric character references. Unknown names are left untouched. */
export function decodeEntities(text: string): string {
  return text.replace(ENTITY, (match, code: string) => {
    if (code.startsWith("#")) {
      const hex = code[1] === "x" || code[1] === "X";
      const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
      const valid = point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff);
      return valid ? String.fromCodePoint(point) : match;
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

/** Some feeds escape twice ("&amp;amp;"), so decode until nothing changes, at most twice. */
function decodeDeep(text: string): string {
  const once = decodeEntities(text);
  return once === text ? once : decodeEntities(once);
}

/**
 * Feed text arrives with one layer of XML escaping. CDATA sections are literal, everything else
 * still needs that layer removed. The result is HTML (or plain text) ready for `htmlToText`.
 */
export function unwrapXmlText(raw: string): string {
  return raw
    .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/)
    .map((part) => (part.startsWith("<![CDATA[") ? part.slice(9, -3) : decodeEntities(part)))
    .join("");
}

export function collapseWhitespace(text: string): string {
  return text
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const COMMENT = /<!--[\s\S]*?-->/g;
const DROPPED_ELEMENT =
  /<(script|style|noscript|figcaption|svg|iframe|template|pre|h[1-6])\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const BLOCK_TAG =
  /<\/?(p|div|br|li|ul|ol|blockquote|tr|table|section|article|header|footer|figure|hr|dd|dt|dl|h[1-6])\b[^>]*>/gi;
const ANY_TAG = /<\/?[a-z][^>]*>/gi;

/** Removes tags and decodes entities; for one-line strings such as titles. */
export function htmlToText(html: string): string {
  return collapseWhitespace(decodeDeep(html.replace(COMMENT, " ").replace(ANY_TAG, " ")));
}

/**
 * Splits HTML into plain-text blocks (paragraphs, list items). Headings, code blocks, captions
 * and scripts are dropped because they never make a good summary.
 */
export function htmlToBlocks(html: string): string[] {
  return html
    .replace(COMMENT, " ")
    .replace(DROPPED_ELEMENT, "\n\n")
    .replace(BLOCK_TAG, "\n\n")
    .replace(ANY_TAG, "")
    .split(/\n\s*\n/)
    .map((block) => collapseWhitespace(decodeDeep(block)))
    .filter((block) => block !== "");
}

const BOILERPLATE: RegExp[] = [
  /\s*The post .{0,300}? appeared first on .{0,80}?\.?\s*$/s,
  /\s*(?:Continue|Read) (?:reading|more)\b.*$/s,
];

/** A teaser cut with "[…]" becomes a plain "…" (or nothing after a full stop). */
const TEASER_END = /([.!?])?[\s,;:]*\[(?:…|\.\.\.)\]\s*$/;

export function removeBoilerplate(text: string): string {
  const cleaned = BOILERPLATE.reduce((result, pattern) => result.replace(pattern, ""), text);
  return cleaned.replace(TEASER_END, (_, end?: string) => end ?? "…").trim();
}

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** True when the summary adds nothing to the title (empty, equal, or a fragment of it). */
export function isTitleEcho(summary: string, title: string): boolean {
  const s = words(summary).join(" ");
  const t = words(title).join(" ");
  if (s === "" || t.includes(s)) return true;
  return s.startsWith(t) && s.length - t.length < 20;
}

function stripTitleAt(summary: string, title: string, force: boolean): string {
  const titleWords = words(title);
  if (titleWords.length === 0) return summary;
  let matched = 0;
  for (const match of summary.matchAll(/[\p{L}\p{N}]+/gu)) {
    if (match[0].toLowerCase() !== titleWords[matched]) return summary;
    matched += 1;
    if (matched === titleWords.length) {
      const rest = summary.slice(match.index + match[0].length);
      const separated = rest.trim() === "" || /^\s*[—–\-:|.!?)"”’]/.test(rest);
      if (!separated && !force && titleWords.length < 6) return summary;
      return rest.replace(/^[\s\p{P}\p{S}]+/u, "");
    }
  }
  return summary;
}

/**
 * Drops the title when a summary starts by repeating it ("Title — the actual dek"), also behind
 * a short label ("Tool: Title …"). Without a label only when a separator follows (or the title is
 * long), so "Codex app now supports…" keeps its subject.
 */
export function stripLeadingTitle(summary: string, title: string): string {
  const stripped = stripTitleAt(summary, title, false);
  if (stripped !== summary) return stripped;
  const label = /^\p{L}+(?: \p{L}+)?:\s+/u.exec(summary);
  if (!label) return summary;
  const afterLabel = summary.slice(label[0].length);
  const result = stripTitleAt(afterLabel, title, true);
  return result === afterLabel ? summary : result;
}

/** Cuts at the last sentence end, else the last word, so a summary never stops mid-word. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const room = text.slice(0, max - 1);
  let sentenceEnd = -1;
  for (const match of room.matchAll(/[.!?]["'”’)]?(?=\s)/g)) {
    sentenceEnd = match.index + match[0].length;
  }
  if (sentenceEnd >= max * 0.5) return room.slice(0, sentenceEnd);
  const lastSpace = room.lastIndexOf(" ");
  const cut = lastSpace >= max * 0.5 ? room.slice(0, lastSpace) : room;
  return `${cut.replace(/[\s,;:.\-–—(]+$/, "")}…`;
}

/** Short lines ending in a colon are bylines or labels ("Jane Doe / Outlet:"), not content. */
function isLabel(block: string): boolean {
  return block.length < 80 && block.endsWith(":");
}

function summaryFrom(html: string, title: string, max: number): string {
  let text = "";
  for (const raw of htmlToBlocks(html)) {
    const block = removeBoilerplate(raw);
    if (block === "" || isLabel(block)) continue;
    text = text ? `${text} ${block}` : block;
    if (text.length >= max / 2) break;
  }
  text = stripLeadingTitle(text, title);
  return isTitleEcho(text, title) ? "" : text;
}

/**
 * Builds the story summary from the feed's description, falling back to the opening of the full
 * content. Returns "" when neither says more than the title.
 */
export function makeSummary(title: string, description: string, content: string, max: number) {
  for (const html of [description, content]) {
    const text = summaryFrom(html, title, max);
    if (text) return truncate(text, max);
  }
  return "";
}
