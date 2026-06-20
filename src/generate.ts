// Creating the double-click launcher in the project root.
//
// The launcher re-invokes THIS CLI in `--launch` mode against the project root,
// baking in this machine's node path and the absolute path to the installed CLI
// so a plain double-click opens the curated VS Code window. Re-run generation if
// the package is moved or reinstalled, since those paths are baked in.

import { execFileSync } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Absolute path to this CLI's entry module (the file the launcher will run).
const SELF = fileURLToPath(import.meta.url);

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
  const node = process.execPath;
  if (process.platform === "win32") {
    const lnk = join(root, `${launcherName}.lnk`);
    const codeExe = join(
      process.env.LOCALAPPDATA ?? "",
      "Programs",
      "Microsoft VS Code",
      "Code.exe",
    );
    const ps = [
      `$ws = New-Object -ComObject WScript.Shell`,
      `$s = $ws.CreateShortcut('${psQuote(lnk)}')`,
      `$s.TargetPath = '${psQuote(node)}'`,
      `$s.Arguments = '"${psQuote(SELF)}" --launch --root "${psQuote(root)}"'`,
      `$s.IconLocation = '${psQuote(codeExe)},0'`,
      `$s.WorkingDirectory = '${psQuote(root)}'`,
      `$s.WindowStyle = 7`, // minimized: avoid a foreground console flash
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
      `#!/usr/bin/env bash\ncd "${root}" && exec "${node}" "${SELF}" --launch --root "${root}"\n`,
    );
    chmodSync(cmd, 0o755);
    console.log(`Created ${cmd}`);
  }
}
