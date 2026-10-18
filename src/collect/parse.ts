import { XMLParser } from "fast-xml-parser";
import { unwrapXmlText } from "./text.ts";

/** One feed entry with its text fields still in HTML form (XML escaping already removed). */
export interface FeedEntry {
  id: string;
  title: string;
  link: string;
  /** RSS description or Atom summary. */
  summary: string;
  /** RSS content:encoded or Atom content. */
  content: string;
  /** Raw date string, "" when the feed has none. */
  date: string;
}

type XmlNode = Record<string, unknown>;

/** Text-bearing elements are kept raw so we control CDATA, entities and inline XHTML ourselves. */
const RAW_TEXT_ELEMENTS = ["title", "description", "summary", "content", "content:encoded"];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  // Titles like "2025" or "0.163.0" must stay strings.
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: false,
  stopNodes: RAW_TEXT_ELEMENTS.map((name) => `*.${name}`),
  isArray: (name) => name === "item" || name === "entry" || name === "link",
});

function asNode(value: unknown): XmlNode | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as XmlNode)
    : undefined;
}

function asList(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Plain value of an element that may carry attributes ({"#text": …}) or repeat. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return textOf(value[0]);
  const node = asNode(value);
  return node ? textOf(node["#text"]) : "";
}

function attr(value: unknown, name: string): string {
  const node = asNode(value);
  const found = node?.[`@_${name}`];
  return typeof found === "string" ? found.trim() : "";
}

function rawText(value: unknown): string {
  return unwrapXmlText(textOf(value));
}

function firstText(node: XmlNode, names: string[]): string {
  for (const name of names) {
    const text = textOf(node[name]);
    if (text) return text;
  }
  return "";
}

function rssLink(item: XmlNode): string {
  for (const link of asList(item.link)) {
    const href = textOf(link) || attr(link, "href");
    if (href) return href;
  }
  const guid = item.guid;
  const permalink = attr(guid, "isPermaLink") !== "false";
  const guidText = textOf(guid);
  return permalink && /^https?:\/\//i.test(guidText) ? guidText : "";
}

function rssItem(item: XmlNode): FeedEntry {
  return {
    id: textOf(item.guid) || rssLink(item),
    title: rawText(item.title),
    link: rssLink(item),
    summary: rawText(item.description),
    content: rawText(item["content:encoded"]),
    date: firstText(item, ["pubDate", "dc:date", "published", "updated"]),
  };
}

function atomLink(entry: XmlNode): string {
  const links = asList(entry.link);
  const alternate = links.find((link) => {
    const rel = attr(link, "rel");
    return (rel === "" || rel === "alternate") && attr(link, "href") !== "";
  });
  const chosen = alternate ?? links.find((link) => attr(link, "href") !== "");
  return chosen ? attr(chosen, "href") : "";
}

function atomEntry(entry: XmlNode): FeedEntry {
  return {
    id: textOf(entry.id),
    title: rawText(entry.title),
    link: atomLink(entry),
    summary: rawText(entry.summary),
    content: rawText(entry.content),
    date: firstText(entry, ["published", "updated", "issued", "modified"]),
  };
}

/** Parses RSS 2.0 (and RDF/RSS 1.0) or Atom. Throws when the body is neither. */
export function parseFeed(xml: string): FeedEntry[] {
  const doc = asNode(parser.parse(xml)) ?? {};
  const atom = asNode(doc.feed);
  if (atom) return asList(atom.entry).flatMap((e) => (asNode(e) ? [atomEntry(e as XmlNode)] : []));
  const channel = asNode(asNode(doc.rss)?.channel);
  const rdf = asNode(doc["rdf:RDF"]);
  if (!channel && !rdf) throw new Error("not an RSS or Atom feed");
  const items = [...asList(channel?.item), ...asList(rdf?.item)];
  return items.flatMap((i) => (asNode(i) ? [rssItem(i as XmlNode)] : []));
}

/** Parses an RFC 822 or ISO 8601 date. Undefined when missing or invalid. */
export function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? undefined : date;
}
