#!/usr/bin/env node
// vsredux CLI: open a project in VS Code with only a curated set of extensions
// enabled, and generate a double-click launcher that does the same.

import { resolve } from "node:path";
import { generate, resolveLauncherName } from "./generate.ts";
import { init } from "./init.ts";
import { launch } from "./launch.ts";

const HELP = `vsredux - open a project in VS Code with only a curated set of extensions enabled.

Usage:
  vsredux [options]                generate the double-click launcher in the project root
  vsredux --launch [options]       open the project with minimal extensions
  vsredux --launch --dry-run       print the launch command without running it
  vsredux --init [options]         write .vscode/extensions.json from installed extensions
  vsredux --init --dry-run         print the generated file without writing it

Options:
  --root <dir>          project root to operate on (default: current directory)
  --keep-file <path>    plain-text file of extra extension ids to keep enabled
                        (default: .vscode/extensions.keep.txt). One id per line;
                        '#' and '//' begin comments.
  --name <name>         base name for the generated launcher file (default:
                        "vsredux"); skips the interactive name prompt
  --extensions-dir <d>  with --init, the VS Code extensions directory to read
                        (default: ~/.vscode/extensions)
  --force               with --init, regenerate even if .vscode/extensions.json
                        already exists (overwrites it)
  -h, --help            show this help

Which extensions stay enabled = the project's .vscode/extensions.json
"recommendations" PLUS any ids in the keep file. Every other installed extension
is disabled for that window. Matching is case-insensitive; duplicates are ignored.

Have no extensions.json yet? Run "vsredux --init" once to seed it from what you
have installed (each id annotated with its name + description), then prune the list.
If it already exists, --init uses it: it offers to open it for editing, or to
create the launcher from the list as it stands.`;

// Read the value following a flag, e.g. --root <value>. Exits on a missing value.
function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  const value = argv[i + 1];
  if (value === undefined || value.startsWith("-")) {
    console.error(`Error: ${name} requires a value`);
    process.exit(1);
  }
  return value;
}

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(HELP);
  process.exit(0);
}

const root = resolve(flagValue(argv, "--root") ?? process.cwd());
const keepFile = flagValue(argv, "--keep-file");
const launcherName = flagValue(argv, "--name");
const extensionsDir = flagValue(argv, "--extensions-dir");
const dryRun = argv.includes("--dry-run");

try {
  if (argv.includes("--launch")) {
    launch({ root, keepFile, dryRun });
  } else if (argv.includes("--init")) {
    await init({ root, extensionsDir, force: argv.includes("--force"), dryRun, launcherName });
  } else {
    generate({ root, launcherName: await resolveLauncherName(launcherName) });
  }
} catch (err) {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
}
