import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/cli.ts", "src/lsp-bin.ts", "src/lsp-server.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
