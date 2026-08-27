import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    // Changesets rewrites CHANGELOG.md on version PRs; keep bot output out of fmt.
    ignorePatterns: ["**/theme.css", "**/CHANGELOG.md", ".agents/**"],
  },
  lint: {
    ignorePatterns: [".agents/**", "**/CHANGELOG.md"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tools/**/*.test.mjs"],
    snapshotFormat: {
      escapeString: false,
    },
  },
});
