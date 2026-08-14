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
      output: {
        // Markdown preview only contributes this one script. A code-split sibling chunk
        // fails to load from the preview webview, so keep the renderer in one file.
        codeSplitting: false,
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
