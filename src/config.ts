// Resolving the set of VS Code extensions to keep enabled for a project window.
//
// The keep set = the project's own `.vscode/extensions.json` "recommendations"
// PLUS any extra ids listed in a plain-text keep file. Both are optional; an
// absent file simply contributes nothing.

import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

// Keep-file locations searched (relative to the project root), first match wins.
// Lives next to `.vscode/extensions.json` so the two extension lists sit together.
const DEFAULT_KEEP_FILES = [".vscode/extensions.keep.txt", ".vscode/extensions.keep"];

// Strip a comment ('#' or '//'), whether on its own line or trailing an entry,
// then surrounding whitespace; blank/comment-only lines fall out via filter().
function parseList(text: string): string[] {
  let body = text;
  if (body.charCodeAt(0) === 0xfeff) body = body.slice(1); // tolerate a UTF-8 byte-order mark
  return body
    .split(/\r?\n/)
    .map((line) => line.replace(/\s*(?:#|\/\/).*$/, "").trim())
    .filter(Boolean);
}

// Resolve the keep-file path: an explicit override (absolute or relative to root)
// if given, otherwise the first existing default location. `undefined` when none.
export function resolveKeepFile(root: string, explicit?: string): string | undefined {
  if (explicit) return isAbsolute(explicit) ? explicit : resolve(root, explicit);
  for (const rel of DEFAULT_KEEP_FILES) {
    const candidate = join(root, rel);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

// Extra extensions to keep, from the plain-text keep file (one id per line).
export function readKeepFile(file: string | undefined): string[] {
  if (!file || !existsSync(file)) return [];
  return parseList(readFileSync(file, "utf8"));
}

// Extensions recommended by the project's own `.vscode/extensions.json`.
// That file is JSONC (comments + trailing commas), so it is sanitized before parsing.
export function readRecommendations(root: string): string[] {
  const p = join(root, ".vscode", "extensions.json");
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* block comments */
    .replace(/\/\/[^\n]*/g, "") // // line comments
    .replace(/,(\s*[}\]])/g, "$1"); // trailing commas
  try {
    const json = JSON.parse(raw) as { recommendations?: unknown };
    return Array.isArray(json.recommendations)
      ? json.recommendations.filter((x): x is string => typeof x === "string")
      : [];
  } catch (err) {
    console.warn(`Warning: could not parse .vscode/extensions.json (${(err as Error).message})`);
    return [];
  }
}

// The set of extensions to keep enabled: project recommendations + keep-file extras,
// trimmed, lower-cased (case-insensitive matching) and de-duplicated across both.
export function keepSet(root: string, keepFile?: string): Set<string> {
  const extras = readKeepFile(resolveKeepFile(root, keepFile));
  return new Set(
    [...readRecommendations(root), ...extras].map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
}
