import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const extensionDir = resolve(root, "apps/diagrams-vscode");
const manifest = JSON.parse(readFileSync(resolve(extensionDir, "package.json"), "utf8"));
const outputDir = resolve(root, "artifacts");
const output = resolve(outputDir, `diagrams-${manifest.version}.vsix`);

mkdirSync(outputDir, { recursive: true });
execFileSync(
  "pnpm",
  ["exec", "vsce", "package", "--no-dependencies", "--out", output, "--githubBranch", "main"],
  { cwd: extensionDir, stdio: "inherit" },
);
execFileSync("node", [resolve(root, "scripts/check-vscode-extension.mjs"), output], {
  cwd: root,
  stdio: "inherit",
});
process.stdout.write(`${output}\n`);
