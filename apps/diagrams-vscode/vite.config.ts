import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      build: {
        command:
          "vp build --config vite.extension.config.ts && vp build --config vite.server.config.ts && vp build --config vite.markdown.config.ts && node ../../scripts/prepare-vscode-runtime.mjs",
        dependsOn: ["@kekonic/diagrams-cli#build", "@kekonic/diagrams-markdown-it#build"],
      },
      package: {
        command: "node ../../scripts/package-vscode-extension.mjs",
        cache: false,
        dependsOn: ["build"],
      },
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
