import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const changesetDir = path.join(root, ".changeset");

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function resolveBefore(before, after) {
  if (/^[0]+$/.test(before)) return `${after}^`;
  try {
    git(["cat-file", "-e", `${before}^{commit}`]);
    return before;
  } catch {
    return `${after}^`;
  }
}

function changedFiles(before, after, pathspec) {
  const output = git([
    "diff",
    "--name-only",
    "--diff-filter=AM",
    `${before}..${after}`,
    "--",
    pathspec,
  ]);
  return output ? output.split("\n") : [];
}

function readPackageVersion(ref, file) {
  try {
    return JSON.parse(git(["show", `${ref}:${file}`])).version;
  } catch {
    return undefined;
  }
}

function packageVersionsChanged(before, after) {
  return changedFiles(before, after, ":(glob)**/package.json").some((file) => {
    const previous = readPackageVersion(before, file);
    const current = JSON.parse(readFileSync(path.join(root, file), "utf8")).version;
    return previous !== undefined && previous !== current;
  });
}

function activeChangesets() {
  return readdirSync(changesetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md")
    .map((entry) => `.changeset/${entry.name}`);
}

const eventBefore = process.env.BEFORE_SHA?.trim();
const eventAfter = process.env.AFTER_SHA?.trim() || process.env.GITHUB_SHA?.trim();
if (!eventBefore || !eventAfter) {
  throw new Error("BEFORE_SHA and AFTER_SHA (or GITHUB_SHA) are required");
}

const before = resolveBefore(eventBefore, eventAfter);
const preState = JSON.parse(readFileSync(path.join(changesetDir, "pre.json"), "utf8"));
const changedPreChangesets =
  preState.mode === "pre"
    ? changedFiles(before, eventAfter, ":(glob).changeset/pre/*.md").filter(
        (file) => path.basename(file) !== "README.md",
      )
    : [];

const recovered = [];
if (changedPreChangesets.length > 0 && !packageVersionsChanged(before, eventAfter)) {
  for (const source of changedPreChangesets) {
    const target = path.join(changesetDir, path.basename(source));
    const sourcePath = path.join(root, source);
    if (existsSync(target) && readFileSync(target, "utf8") !== readFileSync(sourcePath, "utf8")) {
      throw new Error(`Cannot recover ${source}: ${path.relative(root, target)} already differs`);
    }
    copyFileSync(sourcePath, target);
    recovered.push(source);
    console.log(
      `::warning title=Recovered misplaced prerelease changeset::${source} was changed without a package version bump; treating it as pending`,
    );
  }
}

const pending = activeChangesets();
const output = [
  `pending=${pending.length > 0}`,
  `count=${pending.length}`,
  `recovered=${recovered.length}`,
];
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `${output.join("\n")}\n`);
}
console.log(
  pending.length > 0
    ? `Detected ${pending.length} pending changeset(s), including ${recovered.length} recovered from prerelease storage`
    : "No pending changesets detected",
);
