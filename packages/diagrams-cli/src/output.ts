import type { Diagnostic } from "@kekonic/diagrams";
import type { ColorMode, CommandOptions } from "./command-model.ts";

export const EXIT_SUCCESS = 0;
export const EXIT_DIAGNOSTICS = 1;
export const EXIT_USAGE = 2;
export const EXIT_OPERATIONAL = 3;
export const MACHINE_OUTPUT_VERSION = 1;

type Writable = Pick<NodeJS.WritableStream, "write"> & { isTTY?: boolean };

export type OutputContext = {
  color: boolean;
  quiet: boolean;
  verbose: boolean;
  debug: boolean;
  stderr: Writable;
};

export function createOutputContext(
  options: Pick<CommandOptions, "color" | "quiet" | "verbose" | "debug">,
  stderr: Writable = process.stderr,
  env: NodeJS.ProcessEnv = process.env,
): OutputContext {
  return {
    color: shouldUseColor(options.color, stderr.isTTY === true, env),
    quiet: options.quiet,
    verbose: options.verbose,
    debug: options.debug,
    stderr,
  };
}

export function shouldUseColor(mode: ColorMode, isTTY: boolean, env: NodeJS.ProcessEnv): boolean {
  if (mode === "always") return true;
  if (mode === "never") return false;
  if (env.NO_COLOR != null || env.FORCE_COLOR === "0") return false;
  if (env.FORCE_COLOR != null) return true;
  return isTTY;
}

export function printDiagnostic(
  context: OutputContext,
  diagnostic: Diagnostic,
  source: string,
  path: string,
): void {
  const { start, end } = diagnostic.range;
  const severity = colorizeSeverity(context, diagnostic.severity);
  context.stderr.write(
    `${bold(context, `${path}:${start.line}:${start.column}`)} ${severity}[${diagnostic.code}] ${diagnostic.message}\n`,
  );

  const lines = source.split(/\r?\n/);
  const line = lines[start.line - 1] ?? "";
  const lineNumber = String(start.line);
  const gutter = " ".repeat(lineNumber.length);
  const startColumn = Math.max(1, start.column);
  const endColumn =
    end.line === start.line ? Math.max(startColumn + 1, end.column) : line.length + 1;
  const markerLength = Math.max(
    1,
    Math.min(endColumn - startColumn, line.length - startColumn + 2),
  );
  context.stderr.write(`${dim(context, `${gutter} |`)}\n`);
  context.stderr.write(`${dim(context, `${lineNumber} |`)} ${line}\n`);
  context.stderr.write(
    `${dim(context, `${gutter} |`)} ${" ".repeat(startColumn - 1)}${severityColor(context, diagnostic.severity, "^".repeat(markerLength))}\n`,
  );
  if (diagnostic.hint) {
    context.stderr.write(
      `${dim(context, `${gutter} =`)} ${cyan(context, "hint:")} ${diagnostic.hint}\n`,
    );
  }
}

export function printSummary(context: OutputContext, message: string): void {
  if (!context.quiet) context.stderr.write(`${message}\n`);
}

export function printProgress(context: OutputContext, message: string): void {
  if (!context.quiet && context.verbose) context.stderr.write(`${dim(context, message)}\n`);
}

export function machineEnvelope<T>(
  command: string,
  payload: T,
): {
  version: 1;
  command: string;
  payload: T;
} {
  return { version: MACHINE_OUTPUT_VERSION, command, payload };
}

export function installPipeErrorHandlers(): void {
  for (const stream of [process.stdout, process.stderr]) {
    stream.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EPIPE") {
        process.exit(EXIT_SUCCESS);
      }
      throw error;
    });
  }
}

function printCode(code: number): string {
  return `\u001b[${code}m`;
}

function styled(context: OutputContext, code: number, text: string): string {
  return context.color ? `${printCode(code)}${text}${printCode(0)}` : text;
}

function bold(context: OutputContext, text: string): string {
  return styled(context, 1, text);
}

function dim(context: OutputContext, text: string): string {
  return styled(context, 2, text);
}

function cyan(context: OutputContext, text: string): string {
  return styled(context, 36, text);
}

function severityColor(
  context: OutputContext,
  severity: Diagnostic["severity"],
  text: string,
): string {
  return styled(context, severity === "error" ? 31 : severity === "warning" ? 33 : 36, text);
}

function colorizeSeverity(context: OutputContext, severity: Diagnostic["severity"]): string {
  return severityColor(context, severity, severity);
}
