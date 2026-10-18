// Fails when anything personal or secret is about to live in this public repository:
// email addresses, home-folder paths, private keys, API tokens, or a non-noreply commit identity.
// Runs in `npm run check`, in CI, and as a pre-commit hook (.githooks/pre-commit).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SAFE_EMAIL = /(@users\.noreply\.github\.com|^noreply@github\.com|@example\.(com|org|net))$/i;

const SECRETS: [string, RegExp][] = [
  ["email address", /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g],
  ["Windows home folder", /\b[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`]+/gi],
  ["macOS or Linux home folder", /(?<![\w.:/])\/(Users|home)\/[A-Za-z0-9._-]+\//g],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["GitHub token", /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/g],
  [
    "API key",
    /\b(sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|xox[abprs]-[A-Za-z0-9-]{10,})\b/g,
  ],
];

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" });

export function findLeaks(text: string): { kind: string; match: string; line: number }[] {
  const leaks: { kind: string; match: string; line: number }[] = [];
  for (const [kind, pattern] of SECRETS) {
    for (const m of text.matchAll(pattern)) {
      if (kind === "email address" && SAFE_EMAIL.test(m[0])) continue;
      leaks.push({ kind, match: m[0], line: text.slice(0, m.index).split("\n").length });
    }
  }
  return leaks;
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
    for (const leak of findLeaks(text)) {
      problems.push(`${file}:${leak.line}  ${leak.kind}: ${leak.match}`);
    }
  }

  const identities = new Set(git("log", "--format=%ae%n%ce").split("\n").filter(Boolean));
  // As a hook, also check the identity the new commit is about to use.
  if (hook) {
    try {
      identities.add(git("config", "user.email").trim());
    } catch {
      problems.push("git user.email is not set: use your GitHub noreply address");
    }
  }
  for (const email of identities) {
    if (!SAFE_EMAIL.test(email))
      problems.push(`commit history  author or committer email: ${email}`);
  }

  if (problems.length > 0) {
    console.error("Personal data or secrets found. Nothing here may reach a public repo:\n");
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      "\nUse your GitHub noreply address for commits and keep secrets in GitHub Actions secrets.",
    );
    process.exit(1);
  }
  console.log(`Privacy check passed: ${identities.size} commit identity, no personal data found.`);
}
