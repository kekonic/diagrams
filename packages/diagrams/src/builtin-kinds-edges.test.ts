import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import {
  BUILTIN_KIND_LIST,
  compile,
  getKindDefaults,
  isKnownShapeId,
  parse,
} from "@kekonic/diagrams-core";
import { getNodeTypeDefinition, resolveNodeTypeGeometry } from "@kekonic/diagrams-geometry";
import { renderPipeline } from "./pipeline/render.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SOURCE = readFileSync(join(ROOT, "examples/builtin-kinds-and-edges.kdiagram"), "utf8");

describe("builtin kinds & edges example", () => {
  it("parses and renders the showcase with every edge operator", async () => {
    const result = await renderPipeline(SOURCE);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.svg).toContain("<svg");

    const usedKinds = new Set(result.graph!.nodes.map((n) => n.kind));
    // Showcase covers a broad slice; the catalog test below asserts every kind.
    expect(usedKinds.size).toBeGreaterThan(40);
    expect(usedKinds.has("service")).toBe(true);
    expect(usedKinds.has("cloud")).toBe(true);
    expect(usedKinds.has("decision")).toBe(true);

    const edgeKinds = new Set(result.graph!.edges.map((e) => e.kind));
    expect(edgeKinds.has("sync")).toBe(true);
    expect(edgeKinds.has("async")).toBe(true);
    expect(edgeKinds.has("dependency")).toBe(true);
    expect(edgeKinds.has("failure")).toBe(true);
  });

  it("maps every builtin kind to a known geometry through the catalog", () => {
    expect(BUILTIN_KIND_LIST.length).toBeGreaterThan(50);
    for (const kind of BUILTIN_KIND_LIST) {
      const { defaults, isBuiltin } = getKindDefaults(kind);
      expect(isBuiltin).toBe(true);
      expect(isKnownShapeId(defaults.shape), `${kind} -> ${defaults.shape}`).toBe(true);
      const nodeType = getNodeTypeDefinition(kind);
      expect(nodeType?.shapeId).toBe(defaults.shape);
      expect(resolveNodeTypeGeometry(kind).id).toBeTruthy();
    }
  });

  it("compiles each builtin kind without errors", () => {
    for (const kind of BUILTIN_KIND_LIST) {
      const source = `diagram {\n  n: ${kind} "Label"\n}\n`;
      const compiled = compile(parse(source));
      expect(
        compiled.diagnostics.filter((d) => d.severity === "error"),
        kind,
      ).toHaveLength(0);
      expect(compiled.graph.nodes[0]?.kind).toBe(kind);
      expect(compiled.graph.nodes[0]?.shape).toBe(getKindDefaults(kind).defaults.shape);
    }
  });

  it("warns on unknown shape overrides (FM111)", () => {
    const compiled = compile(parse(`diagram { n: service "S" { shape: not-a-real-shape } }`));
    expect(compiled.diagnostics.some((d) => d.code === "FM111")).toBe(true);
  });

  it("renders bare geometry kinds from the showcase example", async () => {
    const source = readFileSync(join(ROOT, "examples/geometry-kinds.kdiagram"), "utf8");
    const result = await renderPipeline(source);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.svg).toContain("polygon"); // diamond/hex
    expect(result.graph!.nodes.some((n) => n.shape === "diamond")).toBe(true);
    expect(result.graph!.nodes.some((n) => n.shape === "cloud")).toBe(true);
    expect(result.graph!.nodes.some((n) => n.shape === "cylinder")).toBe(true);
  });
});
