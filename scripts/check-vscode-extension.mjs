import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { resolve } from "node:path";

const ICONIFY_COLLECTIONS = ["carbon", "logos", "lucide", "mdi", "simple-icons"];

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
  "extension/dist/preview-webview.js",
  "extension/dist/elk-api.js",
  "extension/dist/elk-worker.min.js",
  "extension/dist/node_modules/@fontsource/inter/files/inter-latin-500-normal.woff",
  ...ICONIFY_COLLECTIONS.flatMap((prefix) => [
    `extension/dist/node_modules/@iconify-json/${prefix}/icons.json`,
    `extension/dist/node_modules/@iconify-json/${prefix}/package.json`,
  ]),
  "extension/media/icon.png",
  "extension/LICENSE.txt",
  "extension/readme.md",
];
for (const entry of required) {
  if (!entries.includes(entry)) throw new Error(`VSIX is missing required file: ${entry}`);
}
const allowedNodeModules = [
  "/dist/node_modules/@fontsource/inter/",
  "/dist/node_modules/@iconify-json/",
];
const forbidden = entries.filter(
  (entry) =>
    (entry.includes("/node_modules/") &&
      !allowedNodeModules.some((prefix) => entry.includes(prefix))) ||
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
const openPreview = manifest.contributes?.commands?.find(
  (command) => command.command === "diagrams.openPreview",
);
if (openPreview?.icon !== "$(open-preview)") {
  throw new Error("Preview command must contribute the $(open-preview) title-bar icon");
}
if (openPreview?.shortTitle !== "Preview") {
  throw new Error("Preview command must contribute shortTitle Preview");
}
if (manifest.contributes?.configuration?.properties?.["diagrams.preview.theme"] == null) {
  throw new Error("Missing diagrams.preview.theme configuration");
}
if (manifest.contributes?.configuration?.properties?.["diagrams.preview.autoOpen"] == null) {
  throw new Error("Missing diagrams.preview.autoOpen configuration");
}
const keybinding = manifest.contributes?.keybindings?.find(
  (binding) => binding.command === "diagrams.openPreview",
);
if (!keybinding || keybinding.when !== "editorLangId == kdiagram") {
  throw new Error("Preview command must contribute a kdiagram-scoped keybinding");
}

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
      ![
        "url",
        "util",
        "path",
        "os",
        "crypto",
        "net",
        "child_process",
        "fs",
        // vscode-languageclient 10 uses Node's readline for stdio of the language server process.
        "readline",
      ].includes(specifier),
  );
if (bareRequires.length > 0) {
  throw new Error(
    `Extension has unpackaged runtime imports: ${[...new Set(bareRequires)].join(", ")}`,
  );
}
if (!extensionCode.includes('getConfiguration("diagrams")')) {
  throw new Error("Extension must read diagrams.preview settings from the diagrams configuration");
}
if (extensionCode.includes('getConfiguration("kdiagram")')) {
  throw new Error("Extension still reads the stale kdiagram configuration namespace");
}
if (!extensionCode.includes("enableScripts")) {
  throw new Error("Interactive preview must enable webview scripts");
}
if (!extensionCode.includes("preview-webview.js")) {
  throw new Error("Extension must load dist/preview-webview.js in the side preview");
}

const serverCode = execFileSync("unzip", ["-p", archive, "extension/dist/server.mjs"], {
  encoding: "utf8",
});
if (/from\s+["']@kekonic\//.test(serverCode)) {
  throw new Error("Language server has unpackaged KDiagram imports");
}

function assertSingleFileBrowserBundle(name, code) {
  if (/import\(["']\.\/dist-[^"']+["']\)/.test(code)) {
    throw new Error(
      `${name} must be a single-file bundle; code-split chunks break the VS Code webview`,
    );
  }
  if (!code.includes("Failed to load icon collection")) {
    throw new Error(`${name} must register offline Iconify collection loaders`);
  }
}

const markdownPreview = execFileSync(
  "unzip",
  ["-p", archive, "extension/dist/markdown-preview.js"],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);
assertSingleFileBrowserBundle("markdown-preview.js", markdownPreview);
if (!markdownPreview.includes("markdown-preview.js")) {
  throw new Error(
    "markdown-preview.js must resolve icon collections from its contributed script URL",
  );
}

const previewWebview = execFileSync("unzip", ["-p", archive, "extension/dist/preview-webview.js"], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
assertSingleFileBrowserBundle("preview-webview.js", previewWebview);
if (!previewWebview.includes("preview-webview.js")) {
  throw new Error("preview-webview.js must resolve icon collections from its script URL");
}
if (!previewWebview.includes("k-diagram") && !previewWebview.includes("KDiagramElement")) {
  throw new Error("preview-webview.js must include the interactive k-diagram element");
}
if (
  !previewWebview.includes("vscode-preview") ||
  !previewWebview.includes("--vscode-focusBorder")
) {
  throw new Error(
    "preview-webview.js must bridge VS Code workbench colors into diagram theme tokens",
  );
}
if (!extensionCode.includes('type: "retheme"') && !extensionCode.includes('type:"retheme"')) {
  throw new Error("Extension must notify the side preview when the active color theme changes");
}
// The shared icon resolver still contains the Iconify CDN default string; side preview must
// register offline collection loaders so that path is unused (asserted above).

if (entries.some((entry) => /^extension\/dist\/dist-.*\.mjs$/.test(entry))) {
  throw new Error("VSIX must not ship code-split browser preview chunks");
}

if (statSync(archive).size > 10 * 1024 * 1024) throw new Error("VSIX exceeds the 10 MiB size gate");

process.stdout.write(
  `VSIX contract passed (${manifest.publisher}.${manifest.name}@${manifest.version}, ${entries.length} files).\n`,
);
