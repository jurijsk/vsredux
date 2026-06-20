// Opening a project in VS Code with only the curated extensions enabled.

import { spawn } from "node:child_process";
import { keepSet } from "./config.ts";
import { listInstalled, resolveCode } from "./vscode.ts";

export interface LaunchOptions {
  // Project folder to open (and whose extension lists are read).
  root: string;
  // Explicit keep-file override; defaults to the conventional location.
  keepFile?: string;
  // Print the command that would run instead of running it.
  dryRun?: boolean;
}

// Open `root` in a new window with every installed extension that is NOT in the
// keep set disabled for that window. Recommendations + keep-file ids stay enabled.
export function launch({ root, keepFile, dryRun }: LaunchOptions): void {
  const code = resolveCode();
  const keep = keepSet(root, keepFile);
  const installed = listInstalled(code);

  const args = ["--new-window"];
  let disabled = 0;
  for (const ext of installed) {
    if (!keep.has(ext.toLowerCase())) {
      args.push("--disable-extension", ext);
      disabled++;
    }
  }
  args.push(root); // open THIS project folder

  if (dryRun) {
    console.error(
      `keeping ${installed.length - disabled} of ${installed.length} installed; disabling ${disabled}`,
    );
    console.log(`${code.launchBin} ${args.join(" ")}`);
    return;
  }
  spawn(code.launchBin, args, { detached: true, stdio: "ignore" }).unref();
}
