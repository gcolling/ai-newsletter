const env = process.env;

export const site = {
  /** Working title until the name is decided. */
  name: "AI Daily",
  tagline: "AI, automation and integrations. Ranked by rules, not by a model.",
  /** Absolute origin + path of the published site, no trailing slash. CI sets it from GitHub Pages. */
  url: (env.SITE_URL ?? "http://localhost:4321").replace(/\/$/, ""),
  /** Path prefix the site is served under, e.g. "/ai-newsletter/" on GitHub Pages. */
  basePath: `/${(env.BASE_PATH ?? "").replace(/^\/|\/$/g, "")}/`.replace("//", "/"),
  repo: "https://github.com/gcolling/ai-newsletter",
};

export const collect = {
  userAgent: "ai-newsletter/1.0 (+https://github.com/gcolling/ai-newsletter)",
  timeoutMs: 20_000,
  retries: 1,
  /** Window used when there is no previous issue to continue from. */
  firstWindowHours: 26,
  /** Never reach further back than this, even after a gap in runs. */
  maxWindowHours: 72,
  summaryLength: 420,
  /** Stories already published in this many past issues are not repeated. */
  dedupeDays: 7,
};

export const paths = {
  data: env.DATA_DIR ?? "data",
  dist: env.DIST_DIR ?? "dist",
};

export const render = {
  /** Size of the "Top stories" view. */
  topCount: 12,
  /** Papers allowed in the top stories; the rest stay under "Papers". */
  maxTopPapers: 2,
  /** Size of the "This week" page. */
  weekCount: 20,
};
