import { describe, expect, it } from "vite-plus/test";
import {
  BUILTIN_SHAPE_IDS,
  compile,
  getKindDefaults,
  isBuiltinKind,
  isGeometryKind,
  listGeometryKinds,
  parse,
} from "../index.ts";

describe("geometry kinds in the DSL", () => {
  it("exposes bare shape ids as builtin kinds", () => {
    const geometryKinds = listGeometryKinds();
    expect(geometryKinds).toContain("diamond");
    expect(geometryKinds).toContain("cylinder");
    expect(geometryKinds).toContain("parallelogram");
    expect(geometryKinds).toContain("folded-document");
    for (const shapeId of BUILTIN_SHAPE_IDS) {
      if (shapeId === "table") continue; // ERD semantic kind owns this id
      expect(isBuiltinKind(shapeId), shapeId).toBe(true);
      expect(getKindDefaults(shapeId).defaults.shape).toBe(shapeId);
    }
  });

  it("compiles geometry kinds without FM102 warnings", () => {
    const src = `diagram {
      d: diamond "Go?"
      c: cloud "AWS"
      y: cylinder "DB"
      x: hex "Prep"
      r: rect "Box"
    }`;
    const result = compile(parse(src));
    expect(result.diagnostics.filter((d) => d.code === "FM102")).toHaveLength(0);
    expect(result.graph.nodes.find((n) => n.id === "d")?.shape).toBe("diamond");
    expect(result.graph.nodes.find((n) => n.id === "c")?.shape).toBe("cloud");
    expect(result.graph.nodes.find((n) => n.id === "y")?.shape).toBe("cylinder");
    expect(result.graph.nodes.find((n) => n.id === "x")?.shape).toBe("hexagon");
    expect(result.graph.nodes.find((n) => n.id === "r")?.shape).toBe("rectangle");
    expect(isGeometryKind("diamond")).toBe(true);
    expect(isGeometryKind("cloud")).toBe(true);
    expect(isGeometryKind("hex")).toBe(true);
    expect(isGeometryKind("service")).toBe(false);
    expect(isGeometryKind("choice")).toBe(false);
  });
});
