import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findSecrets } from "../../src/dev/secrets-check.ts";

// Samples are built at runtime so this file never contains a real-looking secret itself.
const kinds = (text: string) => findSecrets(text).map((s) => s.kind);

describe("secrets check", () => {
  it("flags private keys and API tokens", () => {
    assert.deepEqual(kinds(`-----BEGIN ${"RSA PRIVATE"} KEY-----`), ["private key"]);
    assert.deepEqual(kinds(`token: ${"ghp_"}${"a".repeat(36)}`), ["GitHub token"]);
    assert.deepEqual(kinds(`key=${"sk-"}${"b".repeat(32)}`), ["API key"]);
    assert.deepEqual(kinds(`${"AKIA"}${"C".repeat(16)}`), ["API key"]);
  });

  it("flags absolute paths from someone's machine", () => {
    assert.deepEqual(kinds(["C:", "Users", "someone", "notes.txt"].join("\\")), [
      "local Windows path",
    ]);
    assert.deepEqual(kinds(`cd ${["", "Users", "someone", "code"].join("/")}`), [
      "local macOS or Linux path",
    ]);
  });

  it("leaves email addresses, version tags and URL paths alone", () => {
    assert.deepEqual(kinds(`someone${"@"}example.com, n8n${"@"}2.44.3`), []);
    assert.deepEqual(kinds("https://example.org/home/page/"), []);
  });
});
