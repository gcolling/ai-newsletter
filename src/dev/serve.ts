// Local preview: builds the site, serves dist/ and rebuilds when src/ changes.
// Falls back to the test fixtures when no issue has been collected yet.
import { spawn } from "node:child_process";
import { readdirSync, watch } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { paths } from "../config.ts";

const port = Number(process.env.PORT ?? 4321);
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/atom+xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function hasIssues(dir: string) {
  try {
    return readdirSync(join(dir, "issues")).some((f) => f.endsWith(".json"));
  } catch {
    return false;
  }
}

const dataDir = hasIssues(paths.data) ? paths.data : "test/fixtures";
if (dataDir !== paths.data) {
  console.log(
    "No collected issues yet, previewing test fixtures. Run `npm run collect` for real data.",
  );
}

// A child process per build, so every template edit is picked up.
function rebuild() {
  return new Promise<void>((resolve) => {
    spawn(process.execPath, ["src/site/index.ts"], {
      stdio: "inherit",
      env: { ...process.env, DATA_DIR: dataDir },
    }).on("exit", () => resolve());
  });
}

await rebuild();

let timer: NodeJS.Timeout | undefined;
watch("src", { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 150);
});

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  let file = join(paths.dist, path);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": types[".html"] });
    res.end(await readFile(join(paths.dist, "404.html")).catch(() => "Not found"));
  }
}).listen(port, "127.0.0.1", () => console.log(`Preview on http://localhost:${port}`));
