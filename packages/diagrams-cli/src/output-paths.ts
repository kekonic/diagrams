import { basename, dirname, extname, resolve } from "node:path";
import { CliUsageError, type ParsedCommand } from "./command-model.ts";
import type { ResolvedInput } from "./input-resolver.ts";

export function renderOutputPaths(
  command: ParsedCommand,
  inputs: readonly ResolvedInput[],
  cwd = process.cwd(),
): Array<string | undefined> {
  const { output, outDir, outputTemplate } = command.options;
  if (inputs.length > 1 && output) {
    throw new CliUsageError("--output accepts only one resolved input");
  }
  if (inputs.length > 1 && !outDir && !outputTemplate) {
    throw new CliUsageError(
      "Multiple render inputs require --out-dir or --output-template; SVG documents are never concatenated",
    );
  }

  const paths = inputs.map((input) => {
    if (output) return resolve(cwd, output);
    if (!outDir && !outputTemplate) return undefined;
    const rendered = applyTemplate(outputTemplate ?? "{path}.svg", input.relativePath);
    return outDir ? resolve(cwd, outDir, rendered) : resolve(cwd, rendered);
  });
  rejectCollisions(paths);
  return paths;
}

function applyTemplate(template: string, relativeInput: string): string {
  const extension = extname(relativeInput);
  const pathWithoutExtension = extension
    ? relativeInput.slice(0, relativeInput.length - extension.length)
    : relativeInput;
  const directory = dirname(pathWithoutExtension) === "." ? "" : dirname(pathWithoutExtension);
  const name = basename(pathWithoutExtension);
  const rendered = template
    .replaceAll("{path}", pathWithoutExtension)
    .replaceAll("{dir}", directory)
    .replaceAll("{name}", name)
    .replaceAll("{ext}", "svg");
  if (!rendered || rendered.endsWith("/")) {
    throw new CliUsageError(`Invalid --output-template result for ${relativeInput}: ${rendered}`);
  }
  return rendered;
}

function rejectCollisions(paths: readonly (string | undefined)[]): void {
  const seen = new Set<string>();
  for (const path of paths) {
    if (!path) continue;
    if (seen.has(path))
      throw new CliUsageError(`Multiple inputs resolve to the same output: ${path}`);
    seen.add(path);
  }
}
