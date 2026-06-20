// Locating the VS Code CLI and listing installed extensions, per platform.

import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface CodeCli {
  // Binary that prints installed extensions via `--list-extensions`.
  listBin: string;
  // Binary that opens an editor window.
  launchBin: string;
}

// Locate the VS Code CLI for the current OS.
export function resolveCode(): CodeCli {
  if (process.platform === "win32") {
    const base = join(process.env.LOCALAPPDATA ?? "", "Programs", "Microsoft VS Code");
    const exe = join(base, "Code.exe");
    const cmd = join(base, "bin", "code.cmd");
    if (existsSync(exe)) return { listBin: existsSync(cmd) ? cmd : "code", launchBin: exe };
    return { listBin: "code", launchBin: "code" };
  }
  // macOS / Linux
  try {
    execSync("command -v code", { stdio: "ignore" });
    return { listBin: "code", launchBin: "code" };
  } catch {
    for (const f of [
      "/opt/homebrew/bin/code",
      "/usr/local/bin/code",
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
    ]) {
      if (existsSync(f)) return { listBin: f, launchBin: f };
    }
  }
  throw new Error(
    "Could not find the 'code' CLI. In VS Code run: Shell Command: Install 'code' command in PATH",
  );
}

// Ids of every extension currently installed for the user.
export function listInstalled(code: CodeCli): string[] {
  const out =
    process.platform === "win32"
      ? execSync(`"${code.listBin}" --list-extensions`, { encoding: "utf8" })
      : execFileSync(code.listBin, ["--list-extensions"], { encoding: "utf8" });
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
