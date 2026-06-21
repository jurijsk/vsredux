import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { collectMeta, renderExtensionsJson } from "../src/init.ts";
import { readRecommendations } from "../src/config.ts";

let extDir: string;

// Create a fake extension on disk: a `<id>-<version>` folder with a package.json
// (and optional package.nls.json), then register it in the directory manifest.
const manifest: Array<{ identifier: { id: string }; relativeLocation: string }> = [];
function addExtension(
  id: string,
  version: string,
  pkg: Record<string, unknown>,
  nls?: Record<string, unknown>,
): void {
  const folder = `${id}-${version}`;
  const dir = join(extDir, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify(pkg), "utf8");
  if (nls) writeFileSync(join(dir, "package.nls.json"), JSON.stringify(nls), "utf8");
  manifest.push({ identifier: { id }, relativeLocation: folder });
}

beforeEach(() => {
  extDir = mkdtempSync(join(tmpdir(), "vsredux-ext-"));
  manifest.length = 0;
});

afterEach(() => {
  rmSync(extDir, { recursive: true, force: true });
});

function writeManifest(): void {
  writeFileSync(join(extDir, "extensions.json"), JSON.stringify(manifest), "utf8");
}

describe("collectMeta", () => {
  test("reads display name and description from package.json via the manifest", () => {
    addExtension("dbaeumer.vscode-eslint", "3.0.24", {
      displayName: "ESLint",
      description: "Integrates ESLint JavaScript into VS Code.",
    });
    writeManifest();

    const meta = collectMeta(extDir, ["dbaeumer.vscode-eslint"]);
    expect(meta.get("dbaeumer.vscode-eslint")).toEqual({
      name: "ESLint",
      description: "Integrates ESLint JavaScript into VS Code.",
    });
  });

  test("resolves %nls% placeholders against package.nls.json (string and {message})", () => {
    addExtension(
      "ms-python.python",
      "2024.1.0",
      { displayName: "%extension.displayName%", description: "%extension.description%" },
      {
        "extension.displayName": "Python",
        "extension.description": { message: "Python language support." },
      },
    );
    writeManifest();

    expect(collectMeta(extDir, ["ms-python.python"]).get("ms-python.python")).toEqual({
      name: "Python",
      description: "Python language support.",
    });
  });

  test("falls back to folder scanning when the manifest is absent", () => {
    // No writeManifest(): the id must be resolved by its `<id>-<version>` folder.
    addExtension("vendor.tool", "1.2.3", { displayName: "Tool" });
    expect(collectMeta(extDir, ["vendor.tool"]).get("vendor.tool")).toEqual({
      name: "Tool",
      description: undefined,
    });
  });

  test("matches ids case-insensitively against the manifest", () => {
    addExtension("Pub.Cased", "1.0.0", { displayName: "Cased" });
    writeManifest();
    expect(collectMeta(extDir, ["pub.cased"]).get("pub.cased")?.name).toBe("Cased");
  });

  test("returns empty metadata for an id with no folder or package.json", () => {
    expect(collectMeta(extDir, ["missing.ext"]).get("missing.ext")).toEqual({});
  });

  test("collapses whitespace and clamps an overlong description to one line", () => {
    addExtension("vendor.verbose", "1.0.0", {
      displayName: "Verbose",
      description: `${"word ".repeat(60)}tail`,
    });
    writeManifest();
    const desc = collectMeta(extDir, ["vendor.verbose"]).get("vendor.verbose")?.description ?? "";
    expect(desc).not.toContain("\n");
    expect(desc.endsWith("…")).toBe(true);
    expect(desc.length).toBeLessThanOrEqual(112);
  });
});

describe("renderExtensionsJson", () => {
  test("annotates ids and round-trips back through readRecommendations", () => {
    const meta = new Map([
      ["dbaeumer.vscode-eslint", { name: "ESLint", description: "Integrates ESLint." }],
      ["vendor.named-only", { name: "Named Only" }],
      ["vendor.desc-only", { description: "Has only a description." }],
      ["vendor.bare", {}], // no metadata -> no comment line
    ]);
    const ids = ["dbaeumer.vscode-eslint", "vendor.named-only", "vendor.desc-only", "vendor.bare"];
    const text = renderExtensionsJson(ids, meta);

    // Comments trail the id on the same line, not on their own line above it.
    expect(text).toContain(`"dbaeumer.vscode-eslint", // ESLint — Integrates ESLint.`);
    expect(text).toContain(`"vendor.named-only", // Named Only`);
    expect(text).toContain(`"vendor.desc-only", // Has only a description.`); // desc, no name
    expect(text).not.toContain("vendor.bare,"); // last entry has no trailing comma
    expect(text).toContain(`    "vendor.bare"\n`); // no comma and no trailing comment

    // The generated JSONC must be consumable by the tool that reads it.
    const root = mkdtempSync(join(tmpdir(), "vsredux-root-"));
    try {
      mkdirSync(join(root, ".vscode"), { recursive: true });
      writeFileSync(join(root, ".vscode", "extensions.json"), text, "utf8");
      expect(readRecommendations(root)).toEqual(ids);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
