// Small interactive prompts, each gated on an interactive terminal (TTY). In a
// non-TTY context (scripts, pipes, CI) there is no one at the keyboard, so the
// helpers fall back to a safe default instead of blocking forever.

import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";

// Ask a question answered with a single keypress: Enter -> true, Esc (or Ctrl-C)
// -> false. Returns undefined when not interactive, so callers can tell "no answer
// possible" apart from an explicit yes/no. No need to confirm the keypress with Enter.
export async function askEnterOrEsc(message: string): Promise<boolean | undefined> {
  const stdin = process.stdin;
  if (!stdin.isTTY) return undefined;

  process.stdout.write(message);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise<boolean | undefined>((resolve) => {
    function done(result: boolean): void {
      stdin.off("keypress", onKey);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      resolve(result);
    }
    function onKey(_s: string | undefined, key: { name?: string; ctrl?: boolean }): void {
      if (key?.name === "return" || key?.name === "enter") done(true);
      else if (key?.name === "escape" || (key?.ctrl && key.name === "c")) done(false);
    }
    stdin.on("keypress", onKey);
  });
}

// Ask for a line of text, showing the default in brackets. Empty input (just Enter)
// yields the default; so does a non-interactive terminal or an interrupted prompt.
export async function askText(label: string, defaultValue: string): Promise<string> {
  if (!process.stdin.isTTY) return defaultValue;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`${label} [${defaultValue}]: `)).trim() || defaultValue;
  } catch {
    return defaultValue; // stdin closed / interrupted
  } finally {
    rl.close();
  }
}
