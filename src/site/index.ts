import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { paths } from "../config.ts";
import type { Issue } from "../types.ts";
import { atomFeed } from "./feed.ts";
import { issuePath } from "./format.ts";
import { assets, href } from "./layout.ts";
import { aboutPage } from "./pages/about.ts";
import { archivePage } from "./pages/archive.ts";
import { issuePage } from "./pages/issue.ts";
import { notFoundPage } from "./pages/not-found.ts";
import { weekPage } from "./pages/week.ts";

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

async function write(path: string, content: string) {
  const file = join(out, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content);
}

const hash = (content: string | Buffer) =>
  createHash("sha256").update(content).digest("hex").slice(0, 10);

/** Self-host the latin subsets of both variable fonts, straight from the npm packages. */
async function fonts(): Promise<string> {
  const sheets = [
    ["@fontsource-variable/mona-sans/standard.css", "Mona Sans"],
    ["@fontsource-variable/newsreader/standard.css", "Newsreader"],
    ["@fontsource-variable/newsreader/standard-italic.css", "Newsreader"],
  ] as const;
  let css = "";
  for (const [entry, family] of sheets) {
    const sheet = require.resolve(entry);
    const blocks = (await readFile(sheet, "utf8")).split("/* ").slice(1);
    for (const block of blocks) {
      if (!/^\S+-latin(-ext)?-standard-/.test(block)) continue;
      const file = block.match(/files\/([\w.-]+\.woff2)/)?.[1];
      if (!file) continue;
      await mkdir(join(out, "assets/fonts"), { recursive: true });
      await copyFile(join(dirname(sheet), "files", file), join(out, "assets/fonts", file));
      css += `@font-face${block
        .slice(block.indexOf("{"))
        .replace(/font-family: '[^']+'/, `font-family: "${family}"`)
        .replace(/url\(\.\/files\//, "url(fonts/")}\n`;
    }
  }
  return css;
}

async function buildAssets() {
  const dir = join(here, "assets");
  const css = (await fonts()) + (await readFile(join(dir, "app.css"), "utf8"));
  const js = await readFile(join(dir, "app.js"), "utf8");
  const icon = await readFile(join(dir, "icon.svg"), "utf8");
  await write("assets/app.css", css);
  await write("assets/app.js", js);
  await write("assets/icon.svg", icon);
  assets.css = `${href("assets/app.css")}?v=${hash(css)}`;
  assets.js = `${href("assets/app.js")}?v=${hash(js)}`;
  assets.icon = `${href("assets/icon.svg")}?v=${hash(icon)}`;
}

export async function build(issues: Issue[]) {
  await rm(out, { recursive: true, force: true });
  await buildAssets();
  const [latest] = issues;
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
  await write("about/index.html", aboutPage());
  await write("404.html", notFoundPage());
  await write("feed.xml", atomFeed(issues));
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
