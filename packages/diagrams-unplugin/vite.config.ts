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
      // TypeScript 7 dts bundling follows unplugin's Vite/esbuild types into
      // vite-plus-core, which uses `import esbuild from 'esbuild'` and fails.
      neverBundle: ["@kekonic/diagrams", "@kekonic/diagrams-build", "unplugin", "esbuild", "vite"],
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
