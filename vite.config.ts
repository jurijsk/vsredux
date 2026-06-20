import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    // CLI-only package: a single executable entry with a shebang. No .d.ts and no
    // auto-managed `exports` field — `bin` is set explicitly in package.json.
    entry: ["src/cli.ts"],
    dts: false,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
