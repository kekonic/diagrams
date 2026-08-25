export type CommandName =
  | "render"
  | "check"
  | "analyze"
  | "capabilities"
  | "ast"
  | "graph"
  | "format"
  | "studio"
  | "lsp"
  | "doctor"
  | "completions";

export type ColorMode = "auto" | "always" | "never";

export type CommandOptions = {
  output?: string;
  outDir?: string;
  outputTemplate?: string;
  theme?: string;
  snapshot: boolean;
  liveTheme: boolean;
  config?: string;
  profile?: string;
  themeFile?: string;
  background?: "transparent" | "theme";
  embedFonts: boolean;
  printSafe: boolean;
  open: boolean;
  noOpen: boolean;
  allowWrite: boolean;
  stdio: boolean;
  port?: string;
  color: ColorMode;
  quiet: boolean;
  verbose: boolean;
  debug: boolean;
  json: boolean;
  pretty: boolean;
  write: boolean;
  check: boolean;
  excludes: string[];
  ignoreFile?: string;
  stdinFilename?: string;
  filesFrom?: string;
  view?: string;
  diagramIndex?: string;
  compareLayouts: boolean;
};

export type ParsedCommand = {
  name: CommandName;
  inputs: string[];
  options: CommandOptions;
};

export class CliUsageError extends Error {
  readonly exitCode = 2;
}

const COMMANDS = new Set<CommandName>([
  "render",
  "check",
  "analyze",
  "capabilities",
  "ast",
  "graph",
  "format",
  "studio",
  "lsp",
  "doctor",
  "completions",
]);

const VALUE_OPTIONS = new Map<
  string,
  | "output"
  | "outDir"
  | "outputTemplate"
  | "theme"
  | "exclude"
  | "ignoreFile"
  | "stdinFilename"
  | "filesFrom"
  | "color"
  | "config"
  | "profile"
  | "themeFile"
  | "background"
  | "port"
  | "view"
  | "diagramIndex"
>([
  ["-o", "output"],
  ["--output", "output"],
  ["--out-dir", "outDir"],
  ["--output-template", "outputTemplate"],
  ["--theme", "theme"],
  ["--exclude", "exclude"],
  ["--ignore-file", "ignoreFile"],
  ["--stdin-filename", "stdinFilename"],
  ["--files-from", "filesFrom"],
  ["--color", "color"],
  ["--config", "config"],
  ["--profile", "profile"],
  ["--theme-file", "themeFile"],
  ["--background", "background"],
  ["--port", "port"],
  ["--view", "view"],
  ["--diagram-index", "diagramIndex"],
] as const);

const BOOLEAN_OPTIONS = new Map<
  string,
  | "snapshot"
  | "liveTheme"
  | "json"
  | "pretty"
  | "write"
  | "check"
  | "quiet"
  | "verbose"
  | "debug"
  | "embedFonts"
  | "printSafe"
  | "open"
  | "noOpen"
  | "allowWrite"
  | "stdio"
  | "compareLayouts"
>([
  ["--snapshot", "snapshot"],
  ["--live-theme", "liveTheme"],
  ["--json", "json"],
  ["--pretty", "pretty"],
  ["--write", "write"],
  ["--check", "check"],
  ["--quiet", "quiet"],
  ["--verbose", "verbose"],
  ["--debug", "debug"],
  ["--embed-fonts", "embedFonts"],
  ["--print-safe", "printSafe"],
  ["--open", "open"],
  ["--no-open", "noOpen"],
  ["--allow-write", "allowWrite"],
  ["--stdio", "stdio"],
  ["--compare-layouts", "compareLayouts"],
] as const);

const DISCOVERY = ["exclude", "ignoreFile", "stdinFilename", "filesFrom"];
const PRESENTATION = ["color", "quiet", "verbose", "debug"];

const ALLOWED_OPTIONS: Record<CommandName, ReadonlySet<string>> = {
  render: new Set([
    "output",
    "outDir",
    "outputTemplate",
    "theme",
    "snapshot",
    "liveTheme",
    "config",
    "profile",
    "themeFile",
    "background",
    "embedFonts",
    "printSafe",
    "view",
    "diagramIndex",
    ...DISCOVERY,
    ...PRESENTATION,
  ]),
  check: new Set(["json", "view", "diagramIndex", ...DISCOVERY, ...PRESENTATION]),
  analyze: new Set([
    "json",
    "pretty",
    "view",
    "diagramIndex",
    "compareLayouts",
    ...DISCOVERY,
    ...PRESENTATION,
  ]),
  capabilities: new Set(["pretty"]),
  ast: new Set(["pretty", "json", ...DISCOVERY, ...PRESENTATION]),
  graph: new Set(["pretty", "json", "view", "diagramIndex", ...DISCOVERY, ...PRESENTATION]),
  format: new Set(["output", "write", "check", ...DISCOVERY, ...PRESENTATION]),
  studio: new Set(["open", "noOpen", "allowWrite", "port", ...DISCOVERY, ...PRESENTATION]),
  lsp: new Set(["stdio"]),
  doctor: new Set(["json", ...PRESENTATION]),
  completions: new Set([]),
};

function defaults(): CommandOptions {
  return {
    snapshot: false,
    liveTheme: false,
    color: "auto",
    quiet: false,
    verbose: false,
    debug: false,
    embedFonts: false,
    printSafe: false,
    open: false,
    noOpen: false,
    allowWrite: false,
    stdio: false,
    json: false,
    pretty: false,
    write: false,
    check: false,
    excludes: [],
    compareLayouts: false,
  };
}

function optionParts(raw: string): { flag: string; inlineValue?: string } {
  if (!raw.startsWith("--")) return { flag: raw };
  const equals = raw.indexOf("=");
  return equals < 0
    ? { flag: raw }
    : { flag: raw.slice(0, equals), inlineValue: raw.slice(equals + 1) };
}

export function parseCommand(argv: readonly string[]): ParsedCommand {
  const name = argv[0];
  if (!COMMANDS.has(name as CommandName)) {
    const suggestion = name ? nearest(name, [...COMMANDS]) : undefined;
    throw new CliUsageError(
      name
        ? `Unknown command: ${name}${suggestion ? `. Did you mean ${suggestion}?` : ""}`
        : "Missing command",
    );
  }

  const command = name as CommandName;
  const inputs: string[] = [];
  const options = defaults();
  let positionalOnly = false;

  for (let index = 1; index < argv.length; index++) {
    const raw = argv[index]!;
    if (raw === "--" && !positionalOnly) {
      positionalOnly = true;
      continue;
    }
    if (raw === "-" || positionalOnly || !raw.startsWith("-")) {
      inputs.push(raw);
      continue;
    }

    const { flag, inlineValue } = optionParts(raw);
    const valueKey = VALUE_OPTIONS.get(flag);
    const booleanKey = BOOLEAN_OPTIONS.get(flag);
    const allowed = ALLOWED_OPTIONS[command];

    if (valueKey) {
      if (!allowed.has(valueKey)) throw new CliUsageError(`Unknown option for ${command}: ${flag}`);
      const value = inlineValue ?? argv[++index];
      if (!value || (inlineValue == null && value.startsWith("-") && value !== "-")) {
        throw new CliUsageError(`Missing value for ${flag}`);
      }
      if (valueKey === "exclude") options.excludes.push(value);
      else if (valueKey === "color") {
        if (value !== "auto" && value !== "always" && value !== "never") {
          throw new CliUsageError(
            `Invalid --color value: ${value} (expected auto, always, or never)`,
          );
        }
        options.color = value;
      } else if (valueKey === "background") {
        if (value !== "transparent" && value !== "theme") {
          throw new CliUsageError(
            `Invalid --background value: ${value} (expected transparent or theme)`,
          );
        }
        options.background = value;
      } else if (valueKey === "theme") {
        options.theme = value;
      } else {
        options[valueKey] = value;
      }
      continue;
    }

    if (booleanKey) {
      if (inlineValue != null) throw new CliUsageError(`${flag} does not accept a value`);
      if (!allowed.has(booleanKey)) {
        throw new CliUsageError(`Unknown option for ${command}: ${flag}`);
      }
      options[booleanKey] = true;
      continue;
    }

    const candidates = [...VALUE_OPTIONS.keys(), ...BOOLEAN_OPTIONS.keys(), "--help", "--version"];
    const suggestion = nearest(flag, candidates);
    throw new CliUsageError(
      `Unknown option: ${flag}${suggestion ? `. Did you mean ${suggestion}?` : ""}`,
    );
  }

  validateOptions(command, options);
  return { name: command, inputs, options };
}

function nearest(value: string, candidates: readonly string[]): string | undefined {
  let best: { value: string; distance: number } | undefined;
  for (const candidate of candidates) {
    const distance = editDistance(value, candidate);
    if (!best || distance < best.distance) best = { value: candidate, distance };
  }
  return best && best.distance <= Math.max(2, Math.floor(value.length / 3))
    ? best.value
    : undefined;
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length]!;
}

function validateOptions(command: CommandName, options: CommandOptions): void {
  if (command === "render") {
    const destinations = [options.output, options.outDir, options.outputTemplate].filter(Boolean);
    if (options.output && destinations.length > 1) {
      throw new CliUsageError("--output cannot be combined with --out-dir or --output-template");
    }
    if (options.snapshot && options.liveTheme) {
      throw new CliUsageError("--snapshot and --live-theme cannot be combined");
    }
  }
  if (command === "format") {
    if (options.write && options.check) {
      throw new CliUsageError("--write and --check cannot be combined");
    }
    if (options.output && (options.write || options.check)) {
      throw new CliUsageError("--output cannot be combined with --write or --check");
    }
  }
  if (command === "studio") {
    if (options.open && options.noOpen) {
      throw new CliUsageError("--open and --no-open cannot be combined");
    }
    if (options.port != null && (!/^\d+$/.test(options.port) || Number(options.port) > 65535)) {
      throw new CliUsageError("--port must be an integer from 0 to 65535");
    }
  }
  if (command === "lsp" && !options.stdio) {
    throw new CliUsageError("lsp requires --stdio");
  }
  if (options.quiet && options.verbose) {
    throw new CliUsageError("--quiet and --verbose cannot be combined");
  }
  if (command === "completions" && options.excludes.length > 0) {
    throw new CliUsageError("completions does not accept discovery options");
  }
}
