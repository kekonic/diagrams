import { defineConfig } from "vite";

export default defineConfig({
  ssr: { noExternal: true },
  build: {
    emptyOutDir: true,
    ssr: true,
    sourcemap: false,
    lib: { entry: "src/extension.ts", formats: ["cjs"] },
    rolldownOptions: {
      external: ["vscode", /^node:/],
      output: { entryFileNames: "extension.cjs" },
    },
  },
});
