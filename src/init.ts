// Generating a `.vscode/extensions.json` seeded from the extensions currently
// installed in VS Code.
//
// Most projects never wrote one, so `vsredux --launch` has no keep set to work
// from and would disable everything. `--init` bootstraps that list: it takes the
// extensions VS Code reports as installed and writes them as `recommendations`,
// annotating each id with a JSONC comment carrying the extension's display name
// and a one-line description. Those are read offline from each installed
// extension's own package.json (resolving VS Code's `%nls%` placeholders) — no
// network call and no AI involved. The result is a starting point to prune down
// to what the project actually needs.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { type CodeCli, listInstalled, resolveCode } from "./vscode.ts";

export interface InitOptions {
  // Project root where `.vscode/extensions.json` is written.
  root: string;
  // Directory VS Code installs user extensions into; defaults to ~/.vscode/extensions.
  extensionsDir?: string;
  // Overwrite an existing `.vscode/extensions.json` instead of refusing.
  force?: boolean;
  // Print the generated file to stdout instead of writing it.
  dryRun?: boolean;
}

// Human-readable metadata for one extension, as shown in the generated comments.
export interface ExtMeta {
  name?: string;
  description?: string;
}

// Default per-user extensions directory. VS Code stores user-installed extensions
// (the ones worth recommending) here on every platform; built-ins live elsewhere.
export function defaultExtensionsDir(): string {
  return join(homedir(), ".vscode", "extensions");
}

// Map every installed extension id (lower-cased) to its on-disk folder name, read
// from the directory's own `extensions.json` manifest. The manifest pins the exact
// folder per id, sidestepping the version/platform suffixes in the folder names.
function readManifest(extensionsDir: string): Map<string, string> {
  const map = new Map<string, string>();
  const file = join(extensionsDir, "extensions.json");
  if (!existsSync(file)) return map;
  try {
    const entries = JSON.parse(readFileSync(file, "utf8")) as Array<{
      identifier?: { id?: string };
      relativeLocation?: string;
    }>;
    for (const e of entries) {
      if (e.identifier?.id && e.relativeLocation) {
        map.set(e.identifier.id.toLowerCase(), e.relativeLocation);
      }
    }
  } catch {
    // A missing or unreadable manifest just means we fall back to folder scanning.
  }
  return map;
}

// Resolve a VS Code `%nls.key%` placeholder against the extension's package.nls.json.
// Non-placeholder strings pass through unchanged. nls values may be plain strings or
// `{ message }` objects; both are handled. Returns undefined when nothing resolves.
function resolveNls(value: string | undefined, dir: string): string | undefined {
  if (!value) return undefined;
  const key = /^%(.+)%$/.exec(value);
  if (!key) return value;
  const nls = join(dir, "package.nls.json");
  if (!existsSync(nls)) return undefined;
  try {
    const entry = (JSON.parse(readFileSync(nls, "utf8")) as Record<string, unknown>)[key[1]];
    if (typeof entry === "string") return entry;
    const message = (entry as { message?: unknown } | undefined)?.message;
    if (typeof message === "string") return message;
  } catch {
    // fall through to undefined
  }
  return undefined;
}

// Collapse whitespace and clamp a description to a single short line for the comment.
function tidy(text: string | undefined, max = 110): string | undefined {
  const one = text?.replace(/\s+/g, " ").trim();
  if (!one) return undefined;
  if (one.length <= max) return one;
  const cut = one.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

// Read display name + description for the extension in `folder`, resolving nls
// placeholders. Returns an empty object when the package.json can't be read.
function readExtMeta(extensionsDir: string, folder: string): ExtMeta {
  const dir = join(extensionsDir, folder);
  try {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      displayName?: string;
      description?: string;
    };
    return {
      name: resolveNls(pkg.displayName, dir),
      description: tidy(resolveNls(pkg.description, dir)),
    };
  } catch {
    return {};
  }
}

// Best-effort folder for an id when the manifest didn't list it: the first folder
// named `<id>-<version>` (case-insensitive). Undefined when none matches.
function findFolder(extensionsDir: string, id: string): string | undefined {
  const prefix = `${id.toLowerCase()}-`;
  try {
    return readdirSync(extensionsDir).find((f) => f.toLowerCase().startsWith(prefix));
  } catch {
    return undefined;
  }
}

// Build id (original casing) -> metadata for every id, reading each extension's
// package.json out of the extensions directory.
export function collectMeta(extensionsDir: string, ids: string[]): Map<string, ExtMeta> {
  const manifest = readManifest(extensionsDir);
  const out = new Map<string, ExtMeta>();
  for (const id of ids) {
    const folder = manifest.get(id.toLowerCase()) ?? findFolder(extensionsDir, id);
    out.set(id, folder ? readExtMeta(extensionsDir, folder) : {});
  }
  return out;
}

// The comment line for an extension: "Name — description", or whichever of the two
// is present, or "" when neither is — some extensions ship only one (or no) field.
export function labelFor(m: ExtMeta): string {
  return [m.name, m.description].filter(Boolean).join(" — ");
}

// Render the `.vscode/extensions.json` text: a recommendations array where each id
// carries a trailing `// Name — description` comment on the same line (or nothing
// when no metadata was found). JSONC, so VS Code reads it and the comments survive.
export function renderExtensionsJson(ids: string[], meta: Map<string, ExtMeta>): string {
  const lines = [
    "{",
    "  // .vscode/extensions.json — extensions VS Code suggests for this project.",
    "  // Generated by vsredux from the extensions currently installed in VS Code.",
    "  // Prune this down to what THIS project needs, then commit it: `vsredux --launch`",
    "  // keeps these enabled for the project window and disables every other extension.",
    `  "recommendations": [`,
  ];
  ids.forEach((id, i) => {
    const label = labelFor(meta.get(id) ?? {});
    const entry = `    ${JSON.stringify(id)}${i < ids.length - 1 ? "," : ""}`;
    lines.push(label ? `${entry} // ${label}` : entry);
  });
  lines.push("  ]", "}", "");
  return lines.join("\n");
}

// After writing the file, offer to open it in VS Code so the user can prune it.
// Interactive terminals only: when stdin isn't a TTY (scripts, pipes, CI) there's
// no one at the keyboard, so we skip rather than block. Enter opens it; Esc (or
// Ctrl-C) quits without opening — a single keypress, no need to confirm with Enter.
async function offerToOpen(code: CodeCli, file: string): Promise<void> {
  const stdin = process.stdin;
  if (!stdin.isTTY) return;

  process.stdout.write("Press Enter to open it in VS Code, or Esc to quit… ");
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();

  const open = await new Promise<boolean>((resolve) => {
    function done(result: boolean): void {
      stdin.off("keypress", onKey);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      resolve(result);
    }
    function onKey(_s: string | undefined, key: { name?: string; ctrl?: boolean }): void {
      if (key?.name === "return" || key?.name === "enter") done(true);
      else if (key?.name === "escape" || (key?.ctrl && key.name === "c")) done(false);
    }
    stdin.on("keypress", onKey);
  });

  if (!open) return;
  const child = spawn(code.launchBin, [file], { detached: true, stdio: "ignore" });
  child.on("error", () => console.error(`Could not launch VS Code; open it yourself: ${file}`));
  child.unref();
}

// Generate `.vscode/extensions.json` for `root` from the installed extension set.
export async function init({ root, extensionsDir, force, dryRun }: InitOptions): Promise<void> {
  const code = resolveCode();
  const dir = extensionsDir ?? defaultExtensionsDir();
  const ids = listInstalled(code).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  if (ids.length === 0) {
    console.error("No installed extensions reported by the 'code' CLI; nothing to write.");
    return;
  }

  const meta = collectMeta(dir, ids);
  const annotated = [...meta.values()].filter((m) => labelFor(m)).length;
  const text = renderExtensionsJson(ids, meta);

  if (dryRun) {
    console.error(`${ids.length} extensions (${annotated} named, from ${dir})`);
    process.stdout.write(text);
    return;
  }

  const target = join(root, ".vscode", "extensions.json");
  if (existsSync(target) && !force) {
    throw new Error(
      `${target} already exists. Re-run with --force to overwrite, or edit it by hand.`,
    );
  }
  mkdirSync(join(root, ".vscode"), { recursive: true });
  writeFileSync(target, text, "utf8");
  console.log(
    `Wrote ${target}: ${ids.length} recommendation${ids.length === 1 ? "" : "s"} ` +
      `(${annotated} annotated). Prune it to what this project actually needs.`,
  );
  await offerToOpen(code, target);
}
