import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { resolve } from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Usage: node scripts/check-vscode-extension.mjs <extension.vsix>");
const archive = resolve(input);
const entries = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
const required = [
  "extension/package.json",
  "extension/dist/extension.cjs",
  "extension/dist/server.mjs",
  "extension/dist/markdown-preview.js",
  "extension/dist/elk-api.js",
  "extension/dist/elk-worker.min.js",
  "extension/dist/node_modules/@fontsource/inter/files/inter-latin-500-normal.woff",
  "extension/media/icon.png",
  "extension/LICENSE.txt",
  "extension/readme.md",
];
for (const entry of required) {
  if (!entries.includes(entry)) throw new Error(`VSIX is missing required file: ${entry}`);
}
const forbidden = entries.filter(
  (entry) =>
    (entry.includes("/node_modules/") &&
      !entry.includes("/dist/node_modules/@fontsource/inter/")) ||
    entry.includes("/src/") ||
    entry.endsWith(".map") ||
    /(^|\/)(\.env|\.npmrc|pnpm-lock\.yaml)$/.test(entry),
);
if (forbidden.length > 0)
  throw new Error(`VSIX contains forbidden files:\n${forbidden.join("\n")}`);

const manifest = JSON.parse(
  execFileSync("unzip", ["-p", archive, "extension/package.json"], { encoding: "utf8" }),
);
if (manifest.publisher !== "kekonic" || manifest.name !== "diagrams") {
  throw new Error(`Unexpected extension identity: ${manifest.publisher}.${manifest.name}`);
}
if (manifest.main !== "./dist/extension.cjs") throw new Error("Unexpected extension entrypoint");
const extensionCode = execFileSync("unzip", ["-p", archive, "extension/dist/extension.cjs"], {
  encoding: "utf8",
  maxBuffer: 10 * 1024 * 1024,
});
const bareRequires = [...extensionCode.matchAll(/require\(["']([^"']+)["']\)/g)]
  .map((match) => match[1])
  .filter(
    (specifier) =>
      specifier !== "vscode" &&
      specifier !== "web-worker" &&
      !specifier.startsWith("node:") &&
      !specifier.startsWith("./") &&
      !["url", "util", "path", "os", "crypto", "net", "child_process", "fs"].includes(specifier),
  );
if (bareRequires.length > 0) {
  throw new Error(
    `Extension has unpackaged runtime imports: ${[...new Set(bareRequires)].join(", ")}`,
  );
}
const serverCode = execFileSync("unzip", ["-p", archive, "extension/dist/server.mjs"], {
  encoding: "utf8",
});
if (/from\s+["']@kekonic\//.test(serverCode)) {
  throw new Error("Language server has unpackaged KDiagram imports");
}
if (statSync(archive).size > 10 * 1024 * 1024) throw new Error("VSIX exceeds the 10 MiB size gate");

process.stdout.write(
  `VSIX contract passed (${manifest.publisher}.${manifest.name}@${manifest.version}, ${entries.length} files).\n`,
);
