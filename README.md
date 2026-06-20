# vsredux

Open any project in **VS Code with only a curated set of extensions enabled** — every
other installed extension is disabled _for that window only_, leaving your global
setup untouched. Also generates a double-click launcher so a teammate can get the
same focused window without touching the terminal.

Useful when a heavy editor profile (linters, AI assistants, language servers for
languages this repo doesn't use) gets in the way of a specific project.

## Which extensions stay enabled

The keep set is computed per project from two sources, merged:

1. **`.vscode/extensions.json` → `recommendations`** — the project's own recommended
   extensions (the primary list).
2. **A plain-text keep file** — extras you want kept that aren't recommendations.
   Searched at `.vscode/extensions.keep.txt` (then `.vscode/extensions.keep`) by
   default, or pass `--keep-file <path>`. One extension id per line; `#` and `//`
   begin comments. Optional.

Matching is case-insensitive and duplicates are removed.

## Install

```bash
npm install -D vsredux     # or: vp add -D vsredux
```

## Usage

Run from the project root (or pass `--root <dir>`):

```bash
# Open the project now, with only the curated extensions enabled:
npx vsredux --launch

# Print what would run, without launching:
npx vsredux --launch --dry-run

# Generate a double-click launcher in the project root:
npx vsredux
#   Windows → "VS Code for Editors.lnk"
#   macOS / Linux → "VS Code for Editors.command"
```

Add it as a script for convenience:

```jsonc
// package.json
"scripts": {
  "code": "vsredux --launch"
}
```

### Options

| Option               | Description                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `--root <dir>`       | Project root to operate on (default: current directory).                                 |
| `--keep-file <path>` | Plain-text file of extra extension ids to keep (default: `.vscode/extensions.keep.txt`). |
| `--name <name>`      | Base name for the generated launcher (default: `VS Code for Editors`).                   |
| `--launch`           | Open the project now instead of generating a launcher.                                   |
| `--dry-run`          | With `--launch`, print the command instead of running it.                                |
| `-h`, `--help`       | Show help.                                                                               |

## The generated launcher

`vsredux` (no `--launch`) writes a launcher into the project root that, when
double-clicked, re-invokes this CLI in `--launch` mode against that project. It
bakes in this machine's Node path and the absolute path to the installed CLI, so
**re-run `vsredux` after moving or reinstalling the package** to refresh those paths.
On Windows the launcher is created via PowerShell's `WScript.Shell`.

## Requirements

- Node.js >= 18.
- The VS Code `code` CLI available (on Windows the user install under
  `%LOCALAPPDATA%\Programs\Microsoft VS Code` is detected automatically; otherwise
  run _Shell Command: Install 'code' command in PATH_ from VS Code).

## Development

This package is built with [Vite+](https://viteplus.dev). Use the `vp` CLI:

```bash
vp install   # install dependencies
vp check     # format, lint, type-check
vp test      # run unit tests
vp pack      # build to dist/
```
