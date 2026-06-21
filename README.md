# vsredux

**Turn a project's _recommended_ extensions into the _only_ extensions it loads.**

VS Code's `.vscode/extensions.json` recommendations are just suggestions — every
extension you've installed globally still loads in every window. `vsredux` promotes
that list into an allow-list: it opens the project with **only the recommended
extensions enabled and every other one disabled**, for that window only. Your global
setup is left untouched.

Perfect for when a heavy editor profile — linters, AI assistants, language servers for
languages this repo doesn't touch — gets in the way of one focused project.

## Quick start

No install needed — run it from the project root with `npx`:

```bash
# 1. No recommendations list yet? Build one from what you already have installed:
npx @jurijsk/vsredux --init

# 2. Open the project with only those extensions enabled:
npx @jurijsk/vsredux --launch

# 3. ...or drop a double-click launcher in the project root (no terminal needed):
npx @jurijsk/vsredux
```

**Step 1** writes `.vscode/extensions.json` listing every installed extension as a
recommendation, each annotated with its name and description — read offline from the
extension itself, no network and no AI. Then **prune it to what the project needs** and
commit it; the curated set now travels with the repo. (It even offers to open the file
so you can start pruning right away.)

**Step 3** drops a launcher that re-opens the same focused window with one double-click
— a `.lnk` on Windows, a `.command` on macOS/Linux — so a teammate never has to touch
the terminal. It works whether you ran via `npx` or a local dev-dependency.

## What stays enabled

The keep set is merged from two sources and matched case-insensitively:

1. **`.vscode/extensions.json` → `recommendations`** — the project's list (commit it).
2. **An optional keep file** — extras that aren't recommendations, one id per line
   (`#` / `//` start comments). Found at `.vscode/extensions.keep.txt`, or pass
   `--keep-file <path>`.

### Tip: wire it into `package.json`

Add it as a dev-dependency so the commands travel with the repo and the whole team
gets the same focused window:

```jsonc
// package.json
"scripts": {
  "code": "vsredux --launch",   // open the focused window
  "code:link": "vsredux"        // (re)generate the double-click launcher
}
```

## Options

| Option                 | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `--launch`             | Open the project now with only the curated set (instead of a launcher).      |
| `--init`               | Generate `.vscode/extensions.json` from your installed extensions.           |
| `--root <dir>`         | Project to operate on (default: current directory).                          |
| `--keep-file <path>`   | Extra ids to keep, one per line (default: `.vscode/extensions.keep.txt`).    |
| `--name <name>`        | Launcher file name (default: `VS Code for Editors`).                         |
| `--extensions-dir <d>` | With `--init`, the extensions dir to read (default: `~/.vscode/extensions`). |
| `--force`              | With `--init`, overwrite an existing `.vscode/extensions.json`.              |
| `--dry-run`            | Preview only: print the launch command, or the generated file.               |
| `-h`, `--help`         | Show help.                                                                   |

## Requirements

- Node.js >= 18.
- The VS Code `code` CLI (auto-detected on Windows; otherwise run _Shell Command:
  Install 'code' command in PATH_ from VS Code).

## Development

Built with [Vite+](https://viteplus.dev): `vp check` (format, lint, types), `vp test`,
`vp pack` (build to `dist/`).
