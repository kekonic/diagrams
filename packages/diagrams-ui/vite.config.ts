import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/playground.ts", "src/shiki/kdiagram.ts", "src/shiki/highlight.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: {
      neverBundle: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@lit/react",
        "@kekonic/diagrams",
        "@kekonic/diagrams-element",
        "shiki",
      ],
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
