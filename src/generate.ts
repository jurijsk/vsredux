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

export function generate({ root, launcherName = "VS Code for Editors" }: GenerateOptions): void {
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
    // `cmd /c npx ...`; WorkingDirectory (below) is the project root, so a local
    // dev-dependency install is resolved when present, else npx fetches the package.
    const args = `/c npx -y ${pkg} --launch --root "${root}"`;
    const ps = [
      `$ws = New-Object -ComObject WScript.Shell`,
      `$s = $ws.CreateShortcut('${psQuote(lnk)}')`,
      `$s.TargetPath = '${psQuote(comspec)}'`,
      `$s.Arguments = '${psQuote(args)}'`,
      `$s.IconLocation = '${psQuote(codeExe)},0'`,
      `$s.WorkingDirectory = '${psQuote(root)}'`,
      `$s.WindowStyle = 7`, // minimized: keep the brief npx console out of the way
      `$s.Description = '${psQuote(launcherName)} - open this project in VS Code with minimal extensions'`,
      `$s.Save()`,
    ].join("; ");
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], {
      stdio: "inherit",
    });
    console.log(`Created ${lnk}`);
  } else {
    const cmd = join(root, `${launcherName}.command`);
    writeFileSync(
      cmd,
      `#!/usr/bin/env bash\ncd "${root}" && exec npx -y ${pkg} --launch --root "${root}"\n`,
    );
    chmodSync(cmd, 0o755);
    console.log(`Created ${cmd}`);
  }
}
