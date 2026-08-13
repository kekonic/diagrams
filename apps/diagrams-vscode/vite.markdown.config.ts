import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/markdown-preview.ts",
      formats: ["es"],
      fileName: () => "markdown-preview.js",
    },
    rolldownOptions: {
      output: { codeSplitting: true, assetFileNames: "assets/[name]-[hash][extname]" },
    },
  },
});
