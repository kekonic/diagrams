import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const assetsDir = new URL("../apps/website/dist/_astro/", import.meta.url);
const files = readdirSync(assetsDir).filter((name) => name.endsWith(".js"));
const failures = [];

for (const name of files) {
  const path = join(assetsDir.pathname, name);
  const source = readFileSync(path);
  const text = source.toString("utf8");

  if (/\bnode:(?:module|fs)\b/.test(text)) {
    failures.push(`${name}: Node-only module/fs imports must not ship to browsers`);
  }

  if (/^var \w+=`(?:logos|simple-icons|mdi|carbon|lucide)`/.test(text.slice(0, 256))) {
    failures.push(`${name}: complete Iconify collections must not ship to browsers`);
  }

  if (name.startsWith("src.")) {
    const gzipBytes = gzipSync(source).byteLength;
    if (gzipBytes > 650_000) {
      failures.push(`${name}: KDiagram runtime is ${gzipBytes} B gzip (budget: 650000 B)`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Browser bundle budget failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

const totalBytes = files.reduce(
  (total, name) => total + statSync(join(assetsDir.pathname, name)).size,
  0,
);
console.log(`Browser bundle gate passed (${files.length} JS chunks, ${totalBytes} B emitted).`);
