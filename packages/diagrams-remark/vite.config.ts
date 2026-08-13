import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: {
      onlyBundle: false,
      neverBundle: [
        "@kekonic/diagrams",
        "@kekonic/diagrams-build",
        "@types/mdast",
        "@types/unist",
        "hast-util-from-html",
        "unified",
        "unist-util-visit",
      ],
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
