#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeDiagramQuality,
  compileSource,
  getCapabilities,
  parseSource,
  renderPipeline,
  type Diagnostic,
} from "@kekonic/diagrams";
import { KDiagramLanguageService } from "@kekonic/diagrams-language-service";
import { CliUsageError, parseCommand, type ParsedCommand } from "./command-model.ts";
import { shellCompletions } from "./completions.ts";
import { runDoctor } from "./doctor.ts";
import { readResolvedInput, resolveCommandInputs, type ResolvedInput } from "./input-resolver.ts";
import {
  createOutputContext,
  EXIT_DIAGNOSTICS,
  EXIT_OPERATIONAL,
  EXIT_SUCCESS,
  EXIT_USAGE,
  installPipeErrorHandlers,
  machineEnvelope,
  printDiagnostic,
  printProgress,
  printSummary,
  type OutputContext,
} from "./output.ts";
import { renderOutputPaths } from "./output-paths.ts";
import { finalizePortableSvg } from "./portable-svg.ts";
import { resolveRenderSettings } from "./project-config.ts";
import { openStudioBrowser, startStudioServer } from "./studio-server.ts";
import { runLanguageServer } from "./lsp-server.ts";

const argv = process.argv.slice(2);
const languageService = new KDiagramLanguageService();
let activeCommand: ParsedCommand | undefined;
installPipeErrorHandlers();

function usage(stream: NodeJS.WritableStream = process.stdout): void {
  stream.write(`kdiagrams — deterministic text-to-diagram tooling

Common jobs:
  kdiagrams check .
  kdiagrams format diagrams/ --check
  kdiagrams render diagrams/ --out-dir public/diagrams
  kdiagrams render architecture.kdiagram -o architecture.svg --print-safe

Commands:
  render [inputs...]       Render portable SVG
  check [inputs...]        Validate source and semantics
  analyze [inputs...]      Analyze rendered layout quality as JSON
  capabilities            Describe the active language and renderer as JSON
  format [inputs...]       Format or check source
  studio [inputs...]       Launch the local browser authoring studio
  lsp --stdio              Run the Language Server Protocol over stdio
  ast [input]              Emit a versioned AST envelope
  graph [input]            Emit a versioned semantic-model envelope
  doctor                   Inspect runtime, font, config, and renderer health
  completions <shell>      Print Bash, Zsh, or Fish completion source

Studio:
  --no-open                Start without opening the browser (opens by default)
  --allow-write            Authorize saving resolved input files
  --port number            Loopback port (default: random available port)

Input discovery:
  --exclude pattern        Git-ignore-style exclusion (repeatable)
  --ignore-file file       Rules file (default: .kdiagramignore)
  --stdin-filename file    Logical filename for piped diagram source
  --files-from file|-      Read additional input paths, one per line

Portable render output:
  -o, --output file        Single output file
  --out-dir dir            Batch output directory; preserves relative paths
  --output-template text   Template using {path}, {dir}, {name}, and {ext}
  --theme name             Built-in or configured theme
  --config file            Project config (default: discovered kekonic-diagrams.config.json)
  --profile name           Named export profile from config
  --theme-file file        JSON custom-property token map
  --live-theme             Retain host-resolved CSS variables (snapshot is default)
  --background mode        transparent or theme
  --embed-fonts            Embed bundled Inter in SVG
  --print-safe             Light snapshot with explicit theme background

Human and machine output:
  --json                   Versioned JSON envelope (check/doctor)
  --pretty                 Pretty versioned JSON (ast/graph)
  --color mode             auto, always, or never
  --quiet                  Suppress summaries and progress
  --verbose                Include progress details
  --debug                  Include stack traces for operational failures
  -v, --version            Print installed version
  -h, --help               Show help

Exit status: 0 success, 1 source/check failure, 2 usage error, 3 operational failure.
`);
}

function version(): string {
  const manifestPath = fileURLToPath(new URL("../package.json", import.meta.url));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as { version?: string };
  return manifest.version ?? "unknown";
}

function printDiagnostics(
  context: OutputContext,
  diagnostics: readonly Diagnostic[],
  source: string,
  path: string,
): void {
  for (const diagnostic of diagnostics) printDiagnostic(context, diagnostic, source, path);
}

async function cmdRender(
  command: ParsedCommand,
  inputs: ResolvedInput[],
  context: OutputContext,
): Promise<number> {
  const outputPaths = renderOutputPaths(command, inputs);
  const settings = resolveRenderSettings(command);
  for (const warning of settings.warnings) {
    if (!context.quiet) context.stderr.write(`warning[FMCLI101] ${warning}\n`);
  }
  if (settings.configPath) printProgress(context, `Using config ${settings.configPath}`);
  if (settings.profileName) printProgress(context, `Using export profile ${settings.profileName}`);

  let failed = false;
  for (let index = 0; index < inputs.length; index++) {
    const input = inputs[index]!;
    const source = readResolvedInput(input);
    printProgress(context, `Rendering ${input.displayPath}`);
    const result = await renderPipeline(source, {
      theme: settings.theme,
      snapshotTheme: settings.snapshotTheme,
      presentation: settings.presentation,
      shadows: false,
    });
    printDiagnostics(context, result.diagnostics, source, input.displayPath);
    if (!result.ok || !result.svg) {
      failed = true;
      continue;
    }

    const svg = finalizePortableSvg(result.svg, settings);
    const outputPath = outputPaths[index];
    if (!outputPath) {
      process.stdout.write(svg);
      continue;
    }
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, svg, "utf-8");
    printSummary(context, `Wrote ${outputPath}`);
  }
  return failed ? EXIT_DIAGNOSTICS : EXIT_SUCCESS;
}

async function cmdAnalyze(command: ParsedCommand, inputs: ResolvedInput[]): Promise<number> {
  const files = [];
  let errorCount = 0;
  let warningCount = 0;
  for (const input of inputs) {
    const source = readResolvedInput(input);
    const result = await renderPipeline(source, { shadows: false });
    const diagnostics = result.diagnostics;
    errorCount += diagnostics.filter((item) => item.severity === "error").length;
    warningCount += diagnostics.filter((item) => item.severity === "warning").length;
    files.push({
      path: input.displayPath,
      diagnostics,
      artifact:
        result.layout && result.graph && result.routing
          ? {
              ...analyzeDiagramQuality(result.graph, result.layout, result.routing.edges).metrics,
              nodes: result.stats.nodeCount,
              edges: result.stats.edgeCount,
              layoutAlgorithm: result.stats.layoutAlgorithm,
              routerAlgorithm: result.stats.routerAlgorithm,
            }
          : undefined,
    });
  }
  process.stdout.write(
    `${JSON.stringify(
      machineEnvelope("analyze", {
        files,
        summary: { files: inputs.length, errors: errorCount, warnings: warningCount },
      }),
      null,
      command.options.pretty ? 2 : undefined,
    )}\n`,
  );
  return errorCount > 0 ? EXIT_DIAGNOSTICS : EXIT_SUCCESS;
}

function cmdCheck(command: ParsedCommand, inputs: ResolvedInput[], context: OutputContext): number {
  const files: Array<{ path: string; diagnostics: Diagnostic[] }> = [];
  let errorCount = 0;
  let warningCount = 0;
  for (const input of inputs) {
    const source = readResolvedInput(input);
    const diagnostics = languageService.updateDocument(inputUri(input), source, 1).diagnostics;
    files.push({ path: input.displayPath, diagnostics });
    errorCount += diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
    warningCount += diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
    if (!command.options.json) {
      printDiagnostics(context, diagnostics, source, input.displayPath);
    }
  }

  if (command.options.json) {
    process.stdout.write(
      `${JSON.stringify(
        machineEnvelope("check", {
          files,
          summary: { files: inputs.length, errors: errorCount, warnings: warningCount },
        }),
      )}\n`,
    );
  } else {
    printSummary(
      context,
      `${inputs.length} file(s): ${errorCount} error(s), ${warningCount} warning(s)`,
    );
  }
  return errorCount > 0 ? EXIT_DIAGNOSTICS : EXIT_SUCCESS;
}

function cmdInspect(
  command: ParsedCommand,
  inputs: ResolvedInput[],
  context: OutputContext,
): number {
  requireSingleInput(command.name, inputs);
  const input = inputs[0]!;
  const source = readResolvedInput(input);
  if (command.name === "ast") {
    const result = parseSource(source);
    printDiagnostics(context, result.diagnostics, source, input.displayPath);
    writeInspectionEnvelope(command, input, result.ast, result.diagnostics);
    return result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
      ? EXIT_DIAGNOSTICS
      : EXIT_SUCCESS;
  }
  const result = compileSource(source);
  printDiagnostics(context, result.diagnostics, source, input.displayPath);
  writeInspectionEnvelope(command, input, result.graph, result.diagnostics);
  return result.diagnostics.some((diagnostic) => diagnostic.severity === "error")
    ? EXIT_DIAGNOSTICS
    : EXIT_SUCCESS;
}

function writeInspectionEnvelope(
  command: ParsedCommand,
  input: ResolvedInput,
  data: unknown,
  diagnostics: readonly Diagnostic[],
): void {
  process.stdout.write(
    `${JSON.stringify(
      machineEnvelope(command.name, {
        path: input.displayPath,
        data,
        diagnostics,
      }),
      null,
      command.options.pretty ? 2 : undefined,
    )}\n`,
  );
}

function cmdFormat(
  command: ParsedCommand,
  inputs: ResolvedInput[],
  context: OutputContext,
): number {
  if (command.options.output) requireSingleInput(command.name, inputs);
  if (!command.options.write && !command.options.check && !command.options.output) {
    requireSingleInput(command.name, inputs);
  }
  if (command.options.write && inputs.some((input) => input.kind === "stdin")) {
    throw new CliUsageError("--write cannot be used with stdin");
  }

  let changed = false;
  for (const input of inputs) {
    const source = readResolvedInput(input);
    const uri = inputUri(input);
    languageService.updateDocument(uri, source, 1);
    const formatted = languageService.format(uri)[0]?.newText ?? source;
    if (command.options.check) {
      if (source !== formatted) {
        changed = true;
        context.stderr.write(`${input.displayPath}: not formatted\n`);
      }
      continue;
    }

    const target = command.options.output
      ? resolve(command.options.output)
      : command.options.write
        ? input.absolutePath
        : undefined;
    if (target) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, formatted, "utf-8");
      printSummary(context, `Wrote ${target}`);
    } else {
      process.stdout.write(formatted);
    }
  }
  return changed ? EXIT_DIAGNOSTICS : EXIT_SUCCESS;
}

function cmdDoctor(command: ParsedCommand, context: OutputContext): number {
  const checks = runDoctor();
  if (command.options.json) {
    process.stdout.write(`${JSON.stringify(machineEnvelope("doctor", { checks }))}\n`);
  } else {
    for (const check of checks) {
      context.stderr.write(
        `${check.status.toUpperCase().padEnd(4)} ${check.name}: ${check.detail}\n`,
      );
    }
  }
  return checks.some((check) => check.status === "fail") ? EXIT_OPERATIONAL : EXIT_SUCCESS;
}

function requireSingleInput(command: string, inputs: readonly ResolvedInput[]): void {
  if (inputs.length !== 1) {
    throw new CliUsageError(
      `${command} requires exactly one resolved input; received ${inputs.length}`,
    );
  }
}

async function main(): Promise<number> {
  if (argv.includes("-v") || argv.includes("--version")) {
    process.stdout.write(`${version()}\n`);
    return EXIT_SUCCESS;
  }
  if (argv.includes("-h") || argv.includes("--help")) {
    usage();
    return EXIT_SUCCESS;
  }
  if (argv.length === 0) {
    usage(process.stderr);
    return EXIT_USAGE;
  }

  const command = parseCommand(argv);
  activeCommand = command;
  const context = createOutputContext(command.options);
  if (command.name === "completions") {
    if (command.inputs.length !== 1) throw new CliUsageError("completions requires one shell");
    process.stdout.write(shellCompletions(command.inputs[0]));
    return EXIT_SUCCESS;
  }
  if (command.name === "doctor") {
    if (command.inputs.length > 0) throw new CliUsageError("doctor does not accept inputs");
    return cmdDoctor(command, context);
  }
  if (command.name === "capabilities") {
    if (command.inputs.length > 0) throw new CliUsageError("capabilities does not accept inputs");
    process.stdout.write(
      `${JSON.stringify(machineEnvelope("capabilities", getCapabilities()), null, command.options.pretty ? 2 : undefined)}\n`,
    );
    return EXIT_SUCCESS;
  }
  if (command.name === "lsp") {
    if (command.inputs.length !== 0) throw new CliUsageError("lsp does not accept inputs");
    return runLanguageServer();
  }

  if (command.name === "studio") {
    const studioCommand = command.inputs.length === 0 ? { ...command, inputs: ["."] } : command;
    const studioInputs = resolveCommandInputs(studioCommand);
    if (studioInputs.some((input) => input.kind === "stdin" || !input.absolutePath)) {
      throw new CliUsageError("studio accepts files, directories, and globs, not stdin");
    }
    const server = await startStudioServer({
      files: studioInputs.map((input) => input.absolutePath!),
      allowWrite: command.options.allowWrite,
      port: Number(command.options.port ?? 0),
    });
    context.stderr.write(`Kekonic Diagrams Studio: ${server.url}\n`);
    if (!command.options.noOpen) await openStudioBrowser(server.url);
    await server.closed;
    return EXIT_SUCCESS;
  }

  const inputs = resolveCommandInputs(command);
  switch (command.name) {
    case "render":
      return cmdRender(command, inputs, context);
    case "check":
      return cmdCheck(command, inputs, context);
    case "analyze":
      return cmdAnalyze(command, inputs);
    case "ast":
    case "graph":
      return cmdInspect(command, inputs, context);
    case "format":
      return cmdFormat(command, inputs, context);
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    if (error instanceof CliUsageError) {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = EXIT_USAGE;
      return;
    }
    const message = operationalMessage(error);
    process.stderr.write(`Operational error: ${message}\n`);
    if (activeCommand?.options.debug && error instanceof Error && error.stack) {
      process.stderr.write(`${error.stack}\n`);
    }
    process.exitCode = EXIT_OPERATIONAL;
  });

function operationalMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT")
      return `File not found: ${(error as NodeJS.ErrnoException).path ?? error.message}`;
    if (code === "EACCES")
      return `Permission denied: ${(error as NodeJS.ErrnoException).path ?? error.message}`;
    return error.message;
  }
  return String(error);
}

function inputUri(input: ResolvedInput): string {
  return input.absolutePath ? `file://${input.absolutePath}` : `stdin://${input.displayPath}`;
}
