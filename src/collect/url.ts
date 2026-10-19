import { createHash } from "node:crypto";

const TRACKING_PARAM = /^(utm_\w+|fbclid|gclid|ref|ref_src|mc_cid|mc_eid)$/i;

/** Hosts where every subdomain is a different publisher. */
const SHARED_HOSTS = new Set([
  "substack.com",
  "github.io",
  "medium.com",
  "blogspot.com",
  "wordpress.com",
  "bearblog.dev",
  "pages.dev",
  "netlify.app",
  "vercel.app",
]);

const COUNTRY_SECOND_LEVEL = /^(co|com|org|net|ac|gov|edu)\.[a-z]{2}$/;

/** Resolves `href` (optionally against `base`) and returns it only if it is http(s). */
export function parseHttpUrl(href: string, base?: string): URL | undefined {
  try {
    const url = new URL(href.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/** The link as shown to readers: absolute, http(s), without tracking parameters. */
export function cleanUrl(
  href: string,
  options: { base?: string; keepFragment?: boolean } = {},
): string | undefined {
  const url = parseHttpUrl(href, options.base);
  if (!url) return undefined;
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  if (!options.keepFragment) url.hash = "";
  return url.href;
}

/**
 * The key used for ids, dedupe and merging. The URL parser already lowercases the host and drops
 * default ports; on top of that we drop tracking parameters, the fragment and a trailing slash.
 * `keepFragment` is for feeds where the fragment is the only thing telling entries apart.
 */
export function canonicalUrl(href: string, keepFragment = false): string {
  const cleaned = cleanUrl(href, { keepFragment });
  if (!cleaned) return href.trim();
  const url = new URL(cleaned);
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.href;
}

/** First 10 characters of the base36 SHA-1 of the canonical URL. Stable across runs. */
export function storyId(canonical: string): string {
  const hex = createHash("sha1").update(canonical).digest("hex");
  return BigInt(`0x${hex}`).toString(36).slice(0, 10);
}

/** Hostname without a leading "www.". */
export function hostOf(href: string): string {
  const url = parseHttpUrl(href);
  return url ? url.hostname.replace(/^www\./, "") : "";
}

/** Approximate registrable domain, so blog.x.com and x.com count as one outlet. */
export function outletOf(href: string): string {
  const parts = hostOf(href).split(".");
  const lastTwo = parts.slice(-2).join(".");
  const keep = SHARED_HOSTS.has(lastTwo) || COUNTRY_SECOND_LEVEL.test(lastTwo) ? 3 : 2;
  return parts.slice(-keep).join(".");
}
