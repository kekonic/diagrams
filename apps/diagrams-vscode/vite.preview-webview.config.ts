import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: "src/preview-webview.ts",
      formats: ["es"],
      fileName: () => "preview-webview.js",
    },
    rolldownOptions: {
      output: {
        // Side preview only contributes this one script. A code-split sibling chunk
        // fails to load from the webview, so keep the renderer in one file.
        codeSplitting: false,
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
});
