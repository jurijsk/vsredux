#!/usr/bin/env node
// vsredux CLI: open a project in VS Code with only a curated set of extensions
// enabled, and generate a double-click launcher that does the same.

import { resolve } from "node:path";
import { generate } from "./generate.ts";
import { launch } from "./launch.ts";

const HELP = `vsredux - open a project in VS Code with only a curated set of extensions enabled.

Usage:
  vsredux [options]                generate the double-click launcher in the project root
  vsredux --launch [options]       open the project with minimal extensions
  vsredux --launch --dry-run       print the launch command without running it

Options:
  --root <dir>        project root to operate on (default: current directory)
  --keep-file <path>  plain-text file of extra extension ids to keep enabled
                      (default: .vscode/extensions.keep.txt). One id per line;
                      '#' and '//' begin comments.
  --name <name>       base name for the generated launcher file
                      (default: "VS Code for Editors")
  -h, --help          show this help

Which extensions stay enabled = the project's .vscode/extensions.json
"recommendations" PLUS any ids in the keep file. Every other installed extension
is disabled for that window. Matching is case-insensitive; duplicates are ignored.`;

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

try {
  if (argv.includes("--launch")) {
    launch({ root, keepFile, dryRun: argv.includes("--dry-run") });
  } else {
    generate({ root, launcherName });
  }
} catch (err) {
  console.error(`Error: ${(err as Error).message}`);
  process.exit(1);
}
