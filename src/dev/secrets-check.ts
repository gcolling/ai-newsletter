// Fails when a secret is about to live in this public repository: private keys, API tokens, or an
// absolute path from someone's machine. Runs in `npm run check`, in CI, and as a pre-commit hook
// (.githooks/pre-commit).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SECRETS: [string, RegExp][] = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["GitHub token", /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
  [
    "API key",
    /\b(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-[A-Za-z0-9-]{10,})\b/g,
  ],
  ["local Windows path", /\b[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`]+/gi],
  ["local macOS or Linux path", /(?<![\w.:/])\/(Users|home)\/[A-Za-z0-9._-]+\//g],
];

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" });

export function findSecrets(text: string): { kind: string; match: string; line: number }[] {
  const found: { kind: string; match: string; line: number }[] = [];
  for (const [kind, pattern] of SECRETS) {
    for (const m of text.matchAll(pattern)) {
      found.push({ kind, match: m[0], line: text.slice(0, m.index).split("\n").length });
    }
  }
  return found;
}

if (import.meta.main) {
  const problems: string[] = [];
  // As a hook, check exactly what is about to be committed (the index), not the working copy.
  const hook = process.argv.includes("--hook");
  const files = hook
    ? git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
    : git("ls-files", "-z");

  for (const file of files.split("\0").filter(Boolean)) {
    let text: string;
    try {
      text = hook ? git("show", `:${file}`) : readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (text.includes("\0")) continue; // binary
    for (const secret of findSecrets(text)) {
      problems.push(`${file}:${secret.line}  ${secret.kind}: ${secret.match}`);
    }
  }

  if (problems.length > 0) {
    console.error("Secrets found. Nothing here may reach a public repo:\n");
    for (const p of problems) console.error(`  ${p}`);
    console.error("\nKeep keys and tokens in GitHub Actions secrets, never in the code.");
    process.exit(1);
  }
  console.log("Secrets check passed.");
}
