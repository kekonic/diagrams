import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { resolveDocument } from "./resolve-document.ts";
import { compile, listCompileTargets } from "@kekonic/diagrams-core";

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), "../../../examples");

describe("resolveDocument", () => {
  it("merges imported core model with local views", () => {
    const entry = join(EXAMPLES, "storefront-model.kdiagram");
    const source = readFileSync(entry, "utf8");
    const resolved = resolveDocument(source, {
      basePath: dirname(entry),
      readFile: (path) => readFileSync(path, "utf8"),
    });

    expect(resolved.ast.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(resolved.dependencyPaths.some((path) => path.endsWith("storefront-core.kdiagram"))).toBe(
      true,
    );

    const targets = listCompileTargets(resolved.ast);
    expect(targets.map((target) => target.viewName).sort((a, b) => a!.localeCompare(b!))).toEqual([
      "containers",
      "context",
    ]);

    const context = compile(resolved.ast, { view: "context" });
    expect(context.graph.nodes.map((node) => node.id)).toContain("platform");
    expect(context.graph.nodes.map((node) => node.id)).toContain("customer");
  });

  it("reports circular imports", () => {
    const dir = mkdtempSync(join(tmpdir(), "kdiagram-import-"));
    writeFileSync(
      join(dir, "a.kdiagram"),
      `kdiagram 2\nimport "./b.kdiagram"\nmodel "A" { a: service "A" }`,
    );
    writeFileSync(
      join(dir, "b.kdiagram"),
      `kdiagram 2\nimport "./a.kdiagram"\nmodel "B" { b: service "B" }`,
    );
    const resolved = resolveDocument(readFileSync(join(dir, "a.kdiagram"), "utf8"), {
      basePath: dir,
      readFile: (path) => readFileSync(path, "utf8"),
    });
    rmSync(dir, { recursive: true, force: true });
    expect(resolved.ast.diagnostics.some((diagnostic) => diagnostic.code === "FM234")).toBe(true);
  });
});
