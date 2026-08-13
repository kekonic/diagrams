import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: {
      neverBundle: ["@kekonic/diagrams", "@kekonic/diagrams-build", "markdown-it"],
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
