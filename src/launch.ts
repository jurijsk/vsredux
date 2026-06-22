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
  // detached + unref so the editor outlives this short-lived launcher process. On
  // Windows launchBin is a .cmd wrapper, which Node >= 18.20 refuses to spawn without
  // a shell; run it through the shell there as a single pre-quoted command string
  // (quoting the binary path and any argument with spaces, e.g. the project root).
  // Passing an args array alongside shell:true is deprecated (DEP0190) precisely
  // because the shell does no quoting of its own, so we build the line ourselves.
  if (process.platform === "win32") {
    const q = (s: string) => (/\s/.test(s) ? `"${s}"` : s);
    const cmdLine = [code.launchBin, ...args].map(q).join(" ");
    spawn(cmdLine, { detached: true, stdio: "ignore", shell: true }).unref();
  } else {
    spawn(code.launchBin, args, { detached: true, stdio: "ignore" }).unref();
  }
}
