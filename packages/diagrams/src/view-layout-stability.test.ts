import { describe, expect, it } from "vite-plus/test";
import type { GraphModel } from "@kekonic/diagrams-core";
import type { LayoutResult } from "@kekonic/diagrams-layout";
import { compareViewLayouts } from "./view-layout-stability.ts";

function layoutWith(nodes: Array<{ id: string; x: number; y: number }>): LayoutResult {
  return {
    width: 100,
    height: 100,
    direction: "LR",
    algorithmVersion: "test",
    layoutMs: 0,
    groups: [],
    edgeLabels: [],
    nodes: nodes.map((node, index) => ({
      nodeId: node.id,
      bounds: { x: node.x, y: node.y, width: 10, height: 10 },
      rank: 0,
      order: index,
    })),
    edgePaths: [],
  };
}

function graphWith(ids: string[]): GraphModel {
  return {
    id: "g",
    nodes: ids.map((id) => ({ id, label: id, kind: "service", styleRefs: [] })),
    edges: [],
    groups: [],
    styles: [],
    animations: [],
    diagnostics: [],
  };
}

describe("compareViewLayouts", () => {
  it("scores stable shared node positions highly", () => {
    const comparison = compareViewLayouts([
      {
        viewName: "a",
        graph: graphWith(["x", "y"]),
        layout: layoutWith([
          { id: "x", x: 10, y: 10 },
          { id: "y", x: 50, y: 10 },
        ]),
      },
      {
        viewName: "b",
        graph: graphWith(["x", "y"]),
        layout: layoutWith([
          { id: "x", x: 10, y: 10 },
          { id: "y", x: 50, y: 10 },
        ]),
      },
    ]);

    expect(comparison.sharedNodes).toEqual(["x", "y"]);
    expect(comparison.stabilityScore).toBe(1);
    expect(comparison.diagnostics).toEqual([]);
  });

  it("warns when shared nodes drift", () => {
    const comparison = compareViewLayouts([
      {
        viewName: "context",
        graph: graphWith(["customer", "stripe"]),
        layout: layoutWith([
          { id: "customer", x: 5, y: 5 },
          { id: "stripe", x: 80, y: 5 },
        ]),
      },
      {
        viewName: "containers",
        graph: graphWith(["customer", "stripe"]),
        layout: layoutWith([
          { id: "customer", x: 5, y: 80 },
          { id: "stripe", x: 80, y: 5 },
        ]),
      },
    ]);

    expect(comparison.stabilityScore).toBeLessThan(0.75);
    expect(comparison.averageDrift).toBeGreaterThan(0.2);
  });
});
