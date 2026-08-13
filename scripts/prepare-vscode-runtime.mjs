import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = resolve(root, "apps/diagrams-vscode/dist");
const layoutRequire = createRequire(resolve(root, "packages/diagrams-layout/package.json"));
const diagramsRequire = createRequire(resolve(root, "packages/diagrams/package.json"));

function copyResolved(resolver, specifier, target) {
  const source = resolver.resolve(specifier);
  const destination = resolve(output, target);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

copyResolved(layoutRequire, "elkjs/lib/elk-worker.min.js", "elk-worker.min.js");
copyResolved(layoutRequire, "elkjs/lib/elk-api.js", "elk-api.js");
copyResolved(
  diagramsRequire,
  "@fontsource/inter/files/inter-latin-500-normal.woff",
  "node_modules/@fontsource/inter/files/inter-latin-500-normal.woff",
);

const fontManifestPath = diagramsRequire.resolve("@fontsource/inter/package.json");
const fontManifest = JSON.parse(readFileSync(fontManifestPath, "utf8"));
writeFileSync(
  resolve(output, "node_modules/@fontsource/inter/package.json"),
  `${JSON.stringify({ name: fontManifest.name, version: fontManifest.version, exports: fontManifest.exports }, null, 2)}\n`,
);
