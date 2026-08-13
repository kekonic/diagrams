import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const manifestUrl = new URL("../.github/retired-npm-packages.json", import.meta.url);
const entries = JSON.parse(readFileSync(manifestUrl, "utf8"));
const checkOnly = process.argv.slice(2).includes("--check");

if (process.argv.length > (checkOnly ? 3 : 2)) {
  throw new Error("Usage: node scripts/deprecate-retired-packages.mjs [--check]");
}
if (!Array.isArray(entries) || entries.length === 0) {
  throw new Error("Retired npm package manifest must contain at least one entry");
}

const specs = new Set();
for (const entry of entries) {
  if (!entry || typeof entry !== "object") throw new Error("Invalid retired package entry");
  const { name, range, message } = entry;
  if (typeof name !== "string" || !/^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/.test(name)) {
    throw new Error(`Invalid retired package name: ${String(name)}`);
  }
  if (typeof range !== "string" || range.trim() === "") {
    throw new Error(`Missing retired package range for ${name}`);
  }
  if (typeof message !== "string" || message.trim() === "") {
    throw new Error(`Missing retirement message for ${name}`);
  }

  const spec = `${name}@${range}`;
  if (specs.has(spec)) throw new Error(`Duplicate retired package spec: ${spec}`);
  specs.add(spec);

  if (!checkOnly) {
    const rawVersions = JSON.parse(
      execFileSync("npm", ["view", spec, "version", "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      }) || "null",
    );
    const versions = Array.isArray(rawVersions) ? rawVersions : [rawVersions].filter(Boolean);
    const existingMessages = versions.map((version) => {
      const output = execFileSync("npm", ["view", `${name}@${version}`, "deprecated", "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      });
      return JSON.parse(output || "null");
    });
    if (existingMessages.length > 0 && existingMessages.every((item) => item === message)) {
      console.log(`${spec} is already deprecated with the intended message; skipping`);
      continue;
    }

    console.log(`Deprecating ${spec}`);
    execFileSync("npm", ["deprecate", spec, message], { stdio: "inherit" });
  }
}

if (checkOnly) console.log(`Retired npm package manifest is valid (${entries.length} entry)`);
