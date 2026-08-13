import { describe, expect, it } from "vite-plus/test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCommand } from "./command-model.ts";
import { resolveCommandInputs } from "./input-resolver.ts";

function fixtureTree(): string {
  const root = mkdtempSync(join(tmpdir(), "kdiagram-inputs-"));
  mkdirSync(join(root, "docs", "nested"), { recursive: true });
  mkdirSync(join(root, "drafts"), { recursive: true });
  writeFileSync(join(root, "docs", "b.kdiagram"), "diagram {}\n");
  writeFileSync(join(root, "docs", "a.kdiagram"), "diagram {}\n");
  writeFileSync(join(root, "docs", "nested", "keep.kdiagram"), "diagram {}\n");
  writeFileSync(join(root, "docs", "nested", "skip.kdiagram"), "diagram {}\n");
  writeFileSync(join(root, "drafts", "draft.kdiagram"), "diagram {}\n");
  writeFileSync(join(root, "docs", "notes.txt"), "not source\n");
  return root;
}

describe("shared CLI input resolver", () => {
  it("recursively discovers directories in stable order and deduplicates globs", () => {
    const cwd = fixtureTree();
    const command = parseCommand(["check", "docs", "docs/**/*.kdiagram"]);
    const inputs = resolveCommandInputs(command, { cwd, stdinIsTTY: true });
    expect(inputs.map((input) => input.relativePath)).toEqual([
      "docs/a.kdiagram",
      "docs/b.kdiagram",
      "docs/nested/keep.kdiagram",
      "docs/nested/skip.kdiagram",
    ]);
  });

  it("applies project ignore rules, negation, and explicit exclusions", () => {
    const cwd = fixtureTree();
    writeFileSync(join(cwd, ".kdiagramignore"), "docs/nested/**\n!docs/nested/keep.kdiagram\n");
    const command = parseCommand(["check", ".", "--exclude", "drafts/**"]);
    const inputs = resolveCommandInputs(command, { cwd, stdinIsTTY: true });
    expect(inputs.map((input) => input.relativePath)).toEqual([
      "docs/a.kdiagram",
      "docs/b.kdiagram",
      "docs/nested/keep.kdiagram",
    ]);
  });

  it("distinguishes source stdin from files-from stdin", () => {
    const cwd = fixtureTree();
    const sourceCommand = parseCommand([
      "check",
      "--stdin-filename",
      "virtual/source.kdiagram",
      "-",
    ]);
    const source = resolveCommandInputs(sourceCommand, {
      cwd,
      stdinIsTTY: false,
      readStdin: () => "diagram {}\n",
    });
    expect(source[0]).toMatchObject({
      kind: "stdin",
      displayPath: "virtual/source.kdiagram",
      relativePath: "virtual/source.kdiagram",
      source: "diagram {}\n",
    });

    const listCommand = parseCommand(["check", "--files-from", "-"]);
    const listed = resolveCommandInputs(listCommand, {
      cwd,
      stdinIsTTY: false,
      readStdin: () => "docs/b.kdiagram\n# comment\ndocs/a.kdiagram\n",
    });
    expect(listed.map((input) => input.relativePath)).toEqual([
      "docs/a.kdiagram",
      "docs/b.kdiagram",
    ]);
  });

  it("keeps diagram stdin separate from a path list file", () => {
    const cwd = fixtureTree();
    writeFileSync(join(cwd, "inputs.txt"), "docs/a.kdiagram\n");
    const command = parseCommand(["check", "--files-from", "inputs.txt", "-"]);
    const inputs = resolveCommandInputs(command, {
      cwd,
      stdinIsTTY: false,
      readStdin: () => 'diagram "Piped" {}\n',
    });
    expect(inputs).toHaveLength(2);
    expect(inputs[1]).toMatchObject({ kind: "stdin", source: 'diagram "Piped" {}\n' });
  });

  it("reads piped source when no input is supplied", () => {
    const command = parseCommand(["check"]);
    const inputs = resolveCommandInputs(command, {
      cwd: fixtureTree(),
      stdinIsTTY: false,
      readStdin: () => "diagram {}\n",
    });
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ kind: "stdin", displayPath: "<stdin>" });
  });
});
