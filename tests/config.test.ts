import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { keepSet, readKeepFile, readRecommendations, resolveKeepFile } from "../src/config.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "vsredux-"));
  mkdirSync(join(root, ".vscode"), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeExtensions(json: string): void {
  writeFileSync(join(root, ".vscode", "extensions.json"), json, "utf8");
}

describe("readRecommendations", () => {
  test("parses JSONC with comments and trailing commas", () => {
    writeExtensions(`{
      // workbench
      "recommendations": [
        "ms-playwright.playwright", // e2e
        "Anthropic.claude-code",
        /* block */ "oxc.oxc-vscode",
      ],
    }`);
    expect(readRecommendations(root)).toEqual([
      "ms-playwright.playwright",
      "Anthropic.claude-code",
      "oxc.oxc-vscode",
    ]);
  });

  test("returns [] when the file is missing", () => {
    expect(readRecommendations(root)).toEqual([]);
  });

  test("returns [] on malformed JSON without throwing", () => {
    writeExtensions("{ not json");
    expect(readRecommendations(root)).toEqual([]);
  });
});

describe("readKeepFile", () => {
  test("strips comments, BOM and blank lines", () => {
    const file = join(root, "keep.txt");
    writeFileSync(
      file,
      "﻿publisher.a\n# a comment\npublisher.b // trailing\n\n  \npublisher.c\n",
      "utf8",
    );
    expect(readKeepFile(file)).toEqual(["publisher.a", "publisher.b", "publisher.c"]);
  });

  test("returns [] for a missing or undefined file", () => {
    expect(readKeepFile(join(root, "nope.txt"))).toEqual([]);
    expect(readKeepFile(undefined)).toEqual([]);
  });
});

describe("resolveKeepFile", () => {
  test("prefers an explicit relative path resolved against root", () => {
    expect(resolveKeepFile(root, "custom.txt")).toBe(join(root, "custom.txt"));
  });

  test("falls back to the default location when it exists", () => {
    const def = join(root, ".vscode", "extensions.keep.txt");
    writeFileSync(def, "publisher.x\n", "utf8");
    expect(resolveKeepFile(root)).toBe(def);
  });

  test("returns undefined when no keep file exists", () => {
    expect(resolveKeepFile(root)).toBeUndefined();
  });
});

describe("keepSet", () => {
  test("merges recommendations with keep-file extras, lower-cased and de-duped", () => {
    writeExtensions(`{ "recommendations": ["Pub.A", "pub.b"] }`);
    writeFileSync(join(root, ".vscode", "extensions.keep.txt"), "pub.a\nPub.C\n", "utf8");
    expect([...keepSet(root)].sort()).toEqual(["pub.a", "pub.b", "pub.c"]);
  });

  test("works with no config at all", () => {
    expect(keepSet(root).size).toBe(0);
  });
});
