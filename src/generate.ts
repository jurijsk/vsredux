// Creating the double-click launcher in the project root.
//
// The launcher re-invokes THIS tool in `--launch` mode against the project root.
// It does so via `npx <pkg>` rather than a baked file path, so the same launcher
// works whether the tool was run through npx (one-off) or installed as a project
// dev-dependency — npx prefers a locally installed copy when present (fast and
// offline) and otherwise fetches it. Nothing machine-specific is baked in, so the
// launcher keeps working across reinstalls and cache evictions.

import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { askText } from "./prompt.ts";

// Default base name for the launcher file. Generic on purpose — the tool's own name
// rather than anyone's particular workflow; override per project with `--name` or
// the interactive prompt.
export const DEFAULT_LAUNCHER_NAME = "vsredux";

// The launcher's base name: an explicit `--name` wins; otherwise ask for one
// (defaulting to DEFAULT_LAUNCHER_NAME), which is a no-op fallback when not a TTY.
export function resolveLauncherName(explicit?: string): Promise<string> {
  return explicit ? Promise.resolve(explicit) : askText("Launcher name", DEFAULT_LAUNCHER_NAME);
}

// This package's published name, read from our own package.json so the launcher's
// npx target tracks the real name even after a rename. Falls back to the known name.
function packageName(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      name?: string;
    };
    if (typeof pkg.name === "string" && pkg.name) return pkg.name;
  } catch {
    // fall back below
  }
  return "@jurijsk/vsredux";
}

export interface GenerateOptions {
  // Project root where the launcher file is written and which it opens.
  root: string;
  // Base name (without extension) for the launcher file.
  launcherName?: string;
}

// Escape single quotes for embedding inside a single-quoted PowerShell string.
function psQuote(s: string): string {
  return s.replace(/'/g, "''");
}

export function generate({ root, launcherName = DEFAULT_LAUNCHER_NAME }: GenerateOptions): void {
  const pkg = packageName();
  if (process.platform === "win32") {
    const lnk = join(root, `${launcherName}.lnk`);
    const codeExe = join(
      process.env.LOCALAPPDATA ?? "",
      "Programs",
      "Microsoft VS Code",
      "Code.exe",
    );
    const comspec = process.env.ComSpec ?? "cmd.exe";
    // `cmd /c npx ... || pause`. WorkingDirectory (below) is the project root, so a
    // local dev-dependency install is resolved when present, else npx fetches the
    // package. On success the window closes immediately; on failure `pause` holds it
    // open showing the error (e.g. an npx resolution failure under a registry
    // cooldown) instead of letting the window flash and vanish with no explanation.
    //
    // `--min-release-age=0` scopes out npm's freshly-published guard for THIS call
    // only. A user with a global `min-release-age` (npm's supply-chain delay) would
    // otherwise have every launch fail with ENOVERSIONS for the first N days after
    // each release, because npx resolves this package by name from the registry and
    // the guard filters out versions younger than the window. npm's
    // `min-release-age-exclude` does not help here: it is honoured only when npm
    // builds an install tree, not on the `npx`/exec manifest-fetch path. The opt-out
    // is safe — the only thing fetched is this package itself, which has no deps.
    const args = `/c npx -y --min-release-age=0 ${pkg} --launch --root "${root}" || pause`;
    const ps = [
      `$ws = New-Object -ComObject WScript.Shell`,
      `$s = $ws.CreateShortcut('${psQuote(lnk)}')`,
      `$s.TargetPath = '${psQuote(comspec)}'`,
      `$s.Arguments = '${psQuote(args)}'`,
      `$s.IconLocation = '${psQuote(codeExe)},0'`,
      `$s.WorkingDirectory = '${psQuote(root)}'`,
      `$s.WindowStyle = 1`, // normal: a failing launch (and its error) must be visible
      `$s.Description = '${psQuote(launcherName)} - open this project in VS Code with minimal extensions'`,
      `$s.Save()`,
    ].join("; ");
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
      stdio: "inherit",
    });
    console.log(`Created ${lnk}`);
  } else {
    const cmd = join(root, `${launcherName}.command`);
    // `--min-release-age=0`: see the win32 branch above — opt this one npx call out
    // of npm's freshly-published guard so a global `min-release-age` doesn't make the
    // launcher fail for the first N days after each release.
    writeFileSync(
      cmd,
      `#!/usr/bin/env bash\ncd "${root}" && exec npx -y --min-release-age=0 ${pkg} --launch --root "${root}"\n`,
    );
    chmodSync(cmd, 0o755);
    console.log(`Created ${cmd}`);
  }
}
