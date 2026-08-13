import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { compileSource } from "../packages/diagrams/dist/index.mjs";

const repoRoot = new URL("../", import.meta.url).pathname;
const contentRoot = join(repoRoot, "apps/website/src/content/docs");
const outputRoot = join(repoRoot, "apps/website/dist");
const failures = [];

function walk(path) {
  return readdirSync(path).flatMap((name) => {
    const target = join(path, name);
    return statSync(target).isDirectory() ? walk(target) : [target];
  });
}

let exampleCount = 0;
for (const file of walk(contentRoot).filter((path) => /\.mdx?$/.test(path))) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/```kdiagram[^\n]*\n([\s\S]*?)```/g)) {
    const source = match[1].trim();
    // Property and fragment snippets are intentionally partial. Complete examples
    // begin with a version header, diagram, or sequence and must compile cleanly.
    if (!/^(?:kdiagram\s+\d+\s+)?(?:diagram|sequence)\b/.test(source)) continue;
    exampleCount++;
    const errors = compileSource(source).diagnostics.filter((item) => item.severity === "error");
    for (const error of errors) {
      failures.push(
        `${file.slice(repoRoot.length)}: ${error.code} at ${error.range.start.line}:${error.range.start.column} — ${error.message}`,
      );
    }
  }
}

const htmlFiles = walk(outputRoot).filter((path) => path.endsWith(".html"));
const studioIndex = join(outputRoot, "studio", "index.html");
if (!existsSync(studioIndex)) {
  failures.push("Docs output must include the canonical Studio app at /studio/");
} else {
  const studioHtml = readFileSync(studioIndex, "utf8");
  if (!studioHtml.includes('content="https://api.iconify.design"')) {
    failures.push("Hosted Studio must explicitly configure its static-compatible icon API");
  }
  if (!studioHtml.includes('content="https://diagrams.kekonic.com/studio/"')) {
    failures.push("Hosted Studio must retain its canonical public sharing URL");
  }
}
let linkCount = 0;
for (const sourceFile of htmlFiles) {
  const html = readFileSync(sourceFile, "utf8");
  for (const match of html.matchAll(/\bhref="([^"]+)"/g)) {
    const href = match[1];
    if (/^(?:https?:|mailto:|data:|javascript:)/.test(href) || href === "#") continue;

    const [rawPath, hash] = href.split("#", 2);
    const pathname = rawPath.split("?", 1)[0];
    let target;
    if (!pathname) target = sourceFile;
    else if (pathname.startsWith("/")) {
      target = pathname.endsWith("/")
        ? join(outputRoot, pathname, "index.html")
        : join(outputRoot, pathname);
    } else {
      const resolved = resolve(dirname(sourceFile), pathname);
      target = pathname.endsWith("/") ? join(resolved, "index.html") : resolved;
    }
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");

    linkCount++;
    const sourceLabel = sourceFile.slice(outputRoot.length);
    if (!existsSync(target)) {
      failures.push(`${sourceLabel}: ${href} points to a missing file`);
      continue;
    }
    if (hash && target.endsWith(".html")) {
      const targetHtml = readFileSync(target, "utf8");
      if (!targetHtml.includes(`id="${hash}"`)) {
        failures.push(`${sourceLabel}: ${href} points to a missing anchor`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Documentation check failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log(
  `Documentation check passed (${exampleCount} complete examples, ${linkCount} internal links across ${htmlFiles.length} pages).`,
);
