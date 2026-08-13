import { defineConfig } from "vite";

export default defineConfig({
  ssr: { noExternal: true },
  build: {
    emptyOutDir: false,
    ssr: true,
    lib: { entry: "src/server.ts", formats: ["es"], fileName: () => "server.mjs" },
    rolldownOptions: { external: [/^node:/] },
  },
});
