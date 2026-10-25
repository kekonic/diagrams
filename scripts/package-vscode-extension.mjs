import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const extensionDir = resolve(root, "apps/diagrams-vscode");
const manifest = JSON.parse(readFileSync(resolve(extensionDir, "package.json"), "utf8"));
const version = process.env.VSCODE_EXTENSION_VERSION?.trim() || manifest.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid VS Code extension package version: ${version}`);
}
const outputDir = resolve(root, "artifacts");
const output = process.env.VSCODE_EXTENSION_OUTPUT
  ? resolve(root, process.env.VSCODE_EXTENSION_OUTPUT)
  : resolve(outputDir, `diagrams-${version}.vsix`);

mkdirSync(dirname(output), { recursive: true });
const packageArgs = [
  "exec",
  "vsce",
  "package",
  version,
  "--no-update-package-json",
  "--no-git-tag-version",
  "--no-dependencies",
  "--out",
  output,
  "--githubBranch",
  "main",
];
if (process.env.VSCODE_EXTENSION_PRE_RELEASE === "true") packageArgs.push("--pre-release");
execFileSync("pnpm", packageArgs, { cwd: extensionDir, stdio: "inherit" });
execFileSync("node", [resolve(root, "scripts/check-vscode-extension.mjs"), output], {
  cwd: root,
  stdio: "inherit",
});
process.stdout.write(`${output}\n`);
