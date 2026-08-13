import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import type { Ignore } from "ignore";
import { globSync, isDynamicPattern } from "tinyglobby";
import { CliUsageError, type ParsedCommand } from "./command-model.ts";

const SOURCE_EXTENSION = ".kdiagram";
const DEFAULT_IGNORE_FILE = ".kdiagramignore";
const CRAWL_IGNORES = ["**/.git/**", "**/node_modules/**"];
const require = createRequire(import.meta.url);
// `ignore` v5 is CommonJS; createRequire preserves its callable runtime export under NodeNext.
const createIgnore = require("ignore") as () => Ignore;

export type ResolvedInput = {
  kind: "file" | "stdin";
  absolutePath?: string;
  displayPath: string;
  relativePath: string;
  source?: string;
};

export type ResolveInputOptions = {
  cwd?: string;
  stdinIsTTY?: boolean;
  readStdin?: () => string;
};

type Candidate = { absolutePath: string; relativePath: string };

export function resolveCommandInputs(
  command: ParsedCommand,
  options: ResolveInputOptions = {},
): ResolvedInput[] {
  const cwd = resolve(options.cwd ?? process.cwd());
  const readStdin = options.readStdin ?? (() => readFileSync(0, "utf-8"));
  const requested = [...command.inputs];

  if (command.options.filesFrom) {
    const listSource = command.options.filesFrom;
    let pathList: string;
    if (listSource === "-") {
      if (requested.includes("-")) {
        throw new CliUsageError("stdin cannot contain both diagram source and --files-from paths");
      }
      pathList = readStdin();
    } else {
      pathList = readFileSync(resolve(cwd, listSource), "utf-8");
    }
    requested.push(...parsePathList(pathList));
  }

  if (requested.length === 0) {
    if (command.options.filesFrom) {
      throw new CliUsageError("--files-from did not provide any input paths");
    }
    if (options.stdinIsTTY ?? process.stdin.isTTY) {
      throw new CliUsageError("Missing input (pass a path, '-' or pipe diagram source on stdin)");
    }
    requested.push("-");
  }

  const files: Candidate[] = [];
  let stdinInput: ResolvedInput | undefined;
  for (const input of requested) {
    if (input === "-") {
      if (stdinInput) throw new CliUsageError("stdin source may be supplied only once");
      const filename = command.options.stdinFilename;
      const absolutePath = filename ? resolve(cwd, filename) : undefined;
      stdinInput = {
        kind: "stdin",
        absolutePath,
        displayPath: filename ?? "<stdin>",
        relativePath: filename ? portableRelativePath(cwd, absolutePath!) : "stdin.kdiagram",
        source: readStdin(),
      };
      continue;
    }
    files.push(...expandInput(input, cwd));
  }

  const filtered = filterIgnoredFiles(
    files,
    cwd,
    command.options.ignoreFile,
    command.options.excludes,
  );
  const unique = new Map<string, Candidate>();
  for (const candidate of filtered) unique.set(resolve(candidate.absolutePath), candidate);
  const resolvedFiles = [...unique.values()]
    .sort((left, right) => comparePaths(left.absolutePath, right.absolutePath))
    .map<ResolvedInput>(({ absolutePath, relativePath }) => ({
      kind: "file",
      absolutePath,
      displayPath: absolutePath,
      relativePath,
    }));
  const result = stdinInput ? [...resolvedFiles, stdinInput] : resolvedFiles;
  if (result.length === 0) throw new CliUsageError("No .kdiagram input files matched");
  return result;
}

export function readResolvedInput(input: ResolvedInput): string {
  if (input.kind === "stdin") return input.source ?? "";
  return readFileSync(input.absolutePath!, "utf-8");
}

function expandInput(input: string, cwd: string): Candidate[] {
  const absolute = resolve(cwd, input);
  if (existsSync(absolute)) {
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      const matches = globSync("**/*.kdiagram", {
        cwd: absolute,
        absolute: true,
        dot: true,
        followSymbolicLinks: false,
        ignore: CRAWL_IGNORES,
      });
      const insideCwd = isWithin(cwd, absolute);
      return matches.map((file) => ({
        absolutePath: file,
        relativePath: insideCwd
          ? portableRelativePath(cwd, file)
          : toPosix(relative(absolute, file)),
      }));
    }
    if (!stats.isFile()) throw new CliUsageError(`Input is not a file or directory: ${input}`);
    if (extname(absolute).toLowerCase() !== SOURCE_EXTENSION) {
      throw new CliUsageError(`Input file must end in ${SOURCE_EXTENSION}: ${input}`);
    }
    return [{ absolutePath: absolute, relativePath: portableRelativePath(cwd, absolute) }];
  }

  if (!isDynamicPattern(input)) throw new CliUsageError(`Input path does not exist: ${input}`);
  return globSync(input, {
    cwd,
    absolute: true,
    dot: true,
    followSymbolicLinks: false,
    onlyFiles: true,
    ignore: CRAWL_IGNORES,
  })
    .filter((file) => extname(file).toLowerCase() === SOURCE_EXTENSION)
    .map((file) => ({
      absolutePath: file,
      relativePath: portableRelativePath(cwd, file),
    }));
}

function filterIgnoredFiles(
  files: readonly Candidate[],
  cwd: string,
  ignoreFileOption: string | undefined,
  excludes: readonly string[],
): Candidate[] {
  const ignoreFile = resolve(cwd, ignoreFileOption ?? DEFAULT_IGNORE_FILE);
  const ignoreRoot = dirname(ignoreFile);
  const ignoreMatcher = existsSync(ignoreFile)
    ? createIgnore().add(readFileSync(ignoreFile, "utf-8"))
    : undefined;
  const excludeMatcher = excludes.length > 0 ? createIgnore().add(excludes) : undefined;
  if (!ignoreMatcher && !excludeMatcher) return [...files];

  return files.filter((candidate) => {
    if (ignoreMatcher && isWithin(ignoreRoot, candidate.absolutePath)) {
      const ignoredPath = toPosix(relative(ignoreRoot, candidate.absolutePath));
      if (ignoreMatcher.ignores(ignoredPath)) return false;
    }
    return !excludeMatcher?.ignores(candidate.relativePath);
  });
}

function isWithin(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function parsePathList(contents: string): string[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function portableRelativePath(cwd: string, absolutePath: string): string {
  const rel = relative(cwd, absolutePath);
  if (!rel || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return basename(absolutePath);
  return toPosix(rel);
}

function toPosix(path: string): string {
  return path.split(sep).join("/");
}

function comparePaths(left: string, right: string): number {
  const a = toPosix(left);
  const b = toPosix(right);
  return a < b ? -1 : a > b ? 1 : 0;
}
