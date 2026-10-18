import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findLeaks } from "../../src/dev/privacy-check.ts";

// Built at runtime so this file never contains a real-looking leak itself.
const at = "@";
const kinds = (text: string) => findLeaks(text).map((l) => l.kind);

describe("privacy check", () => {
  it("flags personal email addresses", () => {
    assert.deepEqual(kinds(`contact: someone${at}gmail.com`), ["email address"]);
  });

  it("allows GitHub noreply and example addresses", () => {
    assert.deepEqual(kinds(`123+someone${at}users.noreply.github.com`), []);
    assert.deepEqual(kinds(`test${at}example.com`), []);
  });

  it("ignores version tags that look like addresses", () => {
    assert.deepEqual(kinds(`n8n${at}2.44.3 and ${at}modelcontextprotocol/server${at}1.2.0`), []);
  });

  it("flags home-folder paths on every OS", () => {
    assert.deepEqual(kinds(["C:", "Users", "someone", "notes.txt"].join("\\")), [
      "Windows home folder",
    ]);
    assert.deepEqual(kinds(`cd ${["", "Users", "someone", "code"].join("/")}`), [
      "macOS or Linux home folder",
    ]);
  });

  it("does not mistake URL paths for home folders", () => {
    assert.deepEqual(kinds("https://example.org/home/page/"), []);
  });

  it("flags private keys and API tokens", () => {
    assert.deepEqual(kinds(`-----BEGIN ${"RSA PRIVATE"} KEY-----`), ["private key"]);
    assert.deepEqual(kinds(`token: ${"ghp_"}${"a".repeat(36)}`), ["GitHub token"]);
    assert.deepEqual(kinds(`key=${"sk-"}${"b".repeat(32)}`), ["API key"]);
    assert.deepEqual(kinds(`${"AKIA"}${"C".repeat(16)}`), ["API key"]);
  });
});
