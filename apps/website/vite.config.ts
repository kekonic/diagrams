import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      dev: {
        command: "astro dev",
        cache: false,
        dependsOn: ["@kekonic/diagrams-studio#build"],
      },
      build: {
        command: "astro build",
        dependsOn: ["@kekonic/diagrams-studio#build"],
      },
      test: "node --test studio-static-integration.node.mjs",
    },
  },
});
