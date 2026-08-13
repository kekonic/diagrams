import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: { onlyBundle: false, neverBundle: ["@kekonic/diagrams"] },
  },
  test: { include: ["src/**/*.test.ts"] },
});
