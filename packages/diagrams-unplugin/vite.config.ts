import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: [
      "src/index.ts",
      "src/vite.ts",
      "src/rollup.ts",
      "src/rolldown.ts",
      "src/webpack.ts",
      "src/rspack.ts",
      "src/esbuild.ts",
    ],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: {
      onlyBundle: false,
      neverBundle: ["@kekonic/diagrams", "@kekonic/diagrams-build", "unplugin"],
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
