import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    // Keep Iconify JSON out of the bundle — load collections on demand.
    deps: {
      neverBundle: ["@iconify/utils", "@iconify/types", /^@iconify-json\//],
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
