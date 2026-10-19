import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { paths, site } from "../config.ts";
import type { Issue } from "../types.ts";
import { atomFeed } from "./feed.ts";
import { issuePath } from "./format.ts";
import { iconPng } from "./icons.ts";
import { assets, href } from "./layout.ts";
import { aboutPage } from "./pages/about.ts";
import { archivePage } from "./pages/archive.ts";
import { issuePage } from "./pages/issue.ts";
import { notFoundPage } from "./pages/not-found.ts";
import { savedPage } from "./pages/saved.ts";
import { weekPage } from "./pages/week.ts";
import { storyFeeds } from "./story-feeds.ts";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const out = paths.dist;

export async function loadIssues(dir = join(paths.data, "issues")): Promise<Issue[]> {
  const files = (await readdir(dir).catch(() => [])).filter((f) =>
    /^\d{4}-\d{2}-\d{2}\.json$/.test(f),
  );
  const issues = await Promise.all(
    files.map(async (f) => JSON.parse(await readFile(join(dir, f), "utf8")) as Issue),
  );
  return issues.filter((i) => i.version === 1).sort((a, b) => b.date.localeCompare(a.date));
}

async function write(path: string, content: string | Buffer) {
  const file = join(out, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

const hash = (content: string | Buffer) =>
  createHash("sha256").update(content).digest("hex").slice(0, 10);

/** Self-host the latin subsets of both variable fonts, straight from the npm packages. */
async function fonts(): Promise<{ css: string; files: string[] }> {
  const sheets = [
    ["@fontsource-variable/mona-sans/standard.css", "Mona Sans"],
    ["@fontsource-variable/newsreader/standard.css", "Newsreader"],
    ["@fontsource-variable/newsreader/standard-italic.css", "Newsreader"],
  ] as const;
  let css = "";
  const files: string[] = [];
  for (const [entry, family] of sheets) {
    const sheet = require.resolve(entry);
    const blocks = (await readFile(sheet, "utf8")).split("/* ").slice(1);
    for (const block of blocks) {
      if (!/^\S+-latin(-ext)?-standard-/.test(block)) continue;
      const file = block.match(/files\/([\w.-]+\.woff2)/)?.[1];
      if (!file) continue;
      await mkdir(join(out, "assets/fonts"), { recursive: true });
      await copyFile(join(dirname(sheet), "files", file), join(out, "assets/fonts", file));
      files.push(href(`assets/fonts/${file}`));
      css += `@font-face${block
        .slice(block.indexOf("{"))
        .replace(/font-family: '[^']+'/, `font-family: "${family}"`)
        .replace(/url\(\.\/files\//, "url(fonts/")}\n`;
    }
  }
  return { css, files };
}

async function buildAssets(): Promise<string[]> {
  const dir = join(here, "assets");
  const font = await fonts();
  const css = font.css + (await readFile(join(dir, "app.css"), "utf8"));
  const js = await readFile(join(dir, "app.js"), "utf8");
  const icon = await readFile(join(dir, "icon.svg"), "utf8");
  await write("assets/app.css", css);
  await write("assets/app.js", js);
  await write("assets/icon.svg", icon);
  assets.css = `${href("assets/app.css")}?v=${hash(css)}`;
  assets.js = `${href("assets/app.js")}?v=${hash(js)}`;
  assets.icon = `${href("assets/icon.svg")}?v=${hash(icon)}`;
  assets.preload = font.files.filter((f) => /-latin-standard-normal.woff2$/.test(f));
  return font.files;
}

/** Home-screen install and offline reading: icons, a web manifest and a service worker. */
async function buildApp(fontFiles: string[], latest: Issue | undefined) {
  await write("assets/icon-192.png", iconPng(192, 0.8));
  await write("assets/icon-512.png", iconPng(512, 0.8));
  await write("assets/apple-touch-icon.png", iconPng(180));
  const manifest = {
    name: site.name,
    short_name: site.name,
    description: site.tagline,
    start_url: href(),
    scope: href(),
    display: "standalone",
    background_color: "#EEF0F3",
    theme_color: "#0A2A8F",
    icons: [
      {
        src: href("assets/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: href("assets/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
  await write("manifest.webmanifest", JSON.stringify(manifest, null, 2));
  const precache = [
    href(),
    href("week/"),
    href("saved/"),
    assets.css,
    assets.js,
    assets.icon,
    ...fontFiles,
  ];
  const sw = (await readFile(join(here, "assets/sw.js"), "utf8"))
    .replace("__VERSION__", hash(precache.join() + (latest?.generatedAt ?? "")))
    .replace("__PRECACHE__", JSON.stringify(precache));
  await write("sw.js", sw);
}

export async function build(issues: Issue[]) {
  await rm(out, { recursive: true, force: true });
  const fontFiles = await buildAssets();
  const [latest] = issues;
  await buildApp(fontFiles, latest);
  if (latest) await write("index.html", issuePage(latest, { older: issues[1] }, true));
  for (const [i, issue] of issues.entries()) {
    const near = { newer: issues[i - 1], older: issues[i + 1] };
    await write(`${issuePath(issue.date)}index.html`, issuePage(issue, near, false));
    await write(`api/issues/${issue.date}.json`, JSON.stringify(issue));
  }
  if (latest) await write("api/latest.json", JSON.stringify(latest));
  const week = weekPage(issues);
  if (week) await write("week/index.html", week);
  await write("archive/index.html", archivePage(issues));
  await write("about/index.html", aboutPage(issues));
  await write("saved/index.html", savedPage());
  await write("404.html", notFoundPage());
  await write("feed.xml", atomFeed(issues));
  for (const feed of storyFeeds(issues)) await write(feed.path, feed.xml);
}

if (import.meta.main) {
  const issues = await loadIssues();
  if (issues.length === 0) {
    console.error(
      `No issues in ${join(paths.data, "issues")}. Run "npm run collect" first, or preview with fixtures: DATA_DIR=test/fixtures npm run build`,
    );
    process.exit(1);
  }
  await build(issues);
  console.log(`Built ${issues.length} issue(s) into ${out}/ (latest ${issues[0]?.date}).`);
}
