import { resolve } from "node:path";
import { defineConfig, lazyPlugins } from "vite-plus";
import { iconSubsetPlugin, saveExamplePlugin } from "./vite.save-example-plugin.ts";

const packages = resolve(__dirname, "..");
const monorepoRoot = resolve(__dirname, "../..");

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    dts: true,
    format: ["esm"],
    sourcemap: true,
    deps: {
      neverBundle: ["@kekonic/diagrams"],
    },
  },
  root: resolve(__dirname, "browser"),
  plugins: lazyPlugins(async () => {
    const { default: react } = await import("@vitejs/plugin-react");
    return [react(), iconSubsetPlugin(), saveExamplePlugin(monorepoRoot)];
  }),
  resolve: {
    conditions: ["browser", "production"],
    alias: [
      {
        find: "@kekonic/diagrams-ui/chrome.css",
        replacement: resolve(packages, "diagrams-ui/src/chrome/tokens.css"),
      },
      {
        find: "@kekonic/diagrams-ui/shiki",
        replacement: resolve(packages, "diagrams-ui/src/shiki/kdiagram.ts"),
      },
      ...[
        "diagrams-ui",
        "diagrams-element",
        "kdiagram",
        "diagrams-core",
        "diagrams-geometry",
        "diagrams-icons",
        "diagrams-layout",
        "diagrams-routing",
        "diagrams-render-svg",
        "diagrams-theme",
      ].map((name) => ({
        find: `@kekonic/${name}`,
        replacement: resolve(packages, `${name}/src/index.ts`),
      })),
    ],
  },
  optimizeDeps: {
    include: ["@iconify/utils"],
  },
  server: {
    fs: {
      allow: [monorepoRoot],
    },
  },
  assetsInclude: ["**/*.kdiagram"],
  base: "./",
  build: {
    outDir: resolve(__dirname, "dist/browser"),
    emptyOutDir: true,
    sourcemap: false,
    // Monaco and ELK each contain a large generated module that Rolldown cannot subdivide. Both
    // live behind real dynamic boundaries; the bundle gate budgets entry and lazy gzip sizes.
    chunkSizeWarningLimit: 2700,
    commonjsOptions: {
      include: [/node_modules/, /packages/],
    },
  },
  test: {
    root: __dirname,
    include: ["src/**/*.test.ts", "browser/src/**/*.test.ts", "browser/src/**/*.test.tsx"],
  },
});
