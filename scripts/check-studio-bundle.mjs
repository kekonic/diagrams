import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const browserDir = new URL("../packages/diagrams-studio/dist/browser/", import.meta.url);
const assetsDir = new URL("./assets/", browserDir);
const index = readFileSync(new URL("./index.html", browserDir), "utf8");
const studioSource = readFileSync(
  new URL("../packages/diagrams-studio/browser/src/styles/app.css", import.meta.url),
  "utf8",
);
const studioEntry = readFileSync(
  new URL("../packages/diagrams-studio/browser/src/styles.ts", import.meta.url),
  "utf8",
);
const studioMain = readFileSync(
  new URL("../packages/diagrams-studio/browser/src/main.tsx", import.meta.url),
  "utf8",
);
const studioConfig = readFileSync(
  new URL("../packages/diagrams-studio/vite.config.ts", import.meta.url),
  "utf8",
);
const scripts = readdirSync(assetsDir).filter((name) => name.endsWith(".js"));
const failures = [];

if (!existsSync(new URL("./favicon.svg", browserDir))) {
  failures.push("Studio browser assets must include the product favicon");
}

if (scripts.length < 6 || scripts.length > 12)
  failures.push(
    `expected the Studio app, editor worker, and bounded lazy chunks; found ${scripts.length}`,
  );
if (/<(?:script|link|img)\b[^>]*(?:src|href)="https?:\/\//i.test(index)) {
  failures.push("browser entry must not load remote runtime assets");
}
if (!index.includes('name="kdiagram-public-studio"')) {
  failures.push("Studio must advertise its canonical public sharing host");
}
if (!studioEntry.includes('import "@kekonic/diagrams-ui/chrome.css"')) {
  failures.push("Studio must consume the shared chrome token contract");
}
if (!studioMain.includes("setIconifyApiBaseUrl(studioIconApiBaseUrl(document))")) {
  failures.push(
    "Studio must resolve requested icons through its configurable document-relative host",
  );
}
if (!studioConfig.includes('root: resolve(__dirname, "browser")')) {
  failures.push("Studio development and production builds must share one browser source");
}
if (!studioConfig.includes("iconSubsetPlugin()")) {
  failures.push("Studio development must serve requested icons from the local workspace");
}
if (!studioConfig.includes("saveExamplePlugin(monorepoRoot)")) {
  failures.push("Studio development must retain the repository example-save adapter");
}
if (!studioConfig.includes('conditions: ["browser", "production"]')) {
  failures.push("Studio production builds must select production browser dependencies");
}
if (!studioConfig.includes("chunkSizeWarningLimit: 2700")) {
  failures.push("Studio must acknowledge its indivisible lazy Monaco/ELK modules explicitly");
}
if (!studioSource.includes("border-radius: var(--radius)")) {
  failures.push("Studio controls must use the shared sharp-corner radius token");
}
if (/border-radius:\s*(?!0(?:[;\s]|$)|var\(--radius\))[\d.]+(?:px|rem|em)/iu.test(studioSource)) {
  failures.push("Studio must not introduce rounded component geometry");
}

const entryMatch = index.match(/<script[^>]+src="\.\/assets\/([^"]+\.js)"/);
const entryName = entryMatch?.[1];
if (!entryName) failures.push("Studio browser entry script is missing");
if (/<link[^>]+rel="modulepreload"[^>]+(?:SourceEditor|editor\.api|wasm|src-)/.test(index)) {
  failures.push("Studio must not preload its lazy editor or rendering-engine chunks");
}

for (const name of scripts) {
  const source = readFileSync(join(assetsDir.pathname, name));
  const text = source.toString("utf8");
  if (/\bnode:(?:fs|http|module|path)\b/.test(text)) {
    failures.push(`${name}: Node-only imports must not ship to Studio browsers`);
  }
  if (text.includes("Lit is in dev mode")) {
    failures.push(`${name}: Studio must use Lit's production browser build`);
  }
  const gzipBytes = gzipSync(source).byteLength;
  if (name === entryName && gzipBytes > 200_000) {
    failures.push(`${name}: Studio initial entry exceeds 200000 B gzip`);
  }
  if (!name.startsWith("editor.worker-") && gzipBytes > 700_000) {
    failures.push(`${name}: Studio lazy chunk exceeds 700000 B gzip`);
  }
}

if (failures.length > 0) {
  console.error(
    `Studio browser bundle check failed:\n${failures.map((item) => `- ${item}`).join("\n")}`,
  );
  process.exit(1);
}

console.log(`Studio browser bundle check passed (${scripts.length} offline scripts).`);
