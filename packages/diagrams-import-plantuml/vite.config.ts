import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: {
      neverBundle: ["@kekonic/diagrams-core"],
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
