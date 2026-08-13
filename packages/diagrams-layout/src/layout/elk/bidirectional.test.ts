import { describe, expect, it } from "vite-plus/test";
import type { GraphModel } from "@kekonic/diagrams-core";
import { measureGraph } from "../../measure/measure.ts";
import { layoutAndRouteWithElk } from "./layout-with-elk.ts";

function mutual(): GraphModel {
  return {
    id: "ab",
    nodes: [
      { id: "a", label: "A", kind: "service", styleRefs: [] },
      { id: "b", label: "B", kind: "service", styleRefs: [] },
    ],
    edges: [
      { id: "e1", from: "b", to: "a", kind: "sync", styleRefs: [] },
      { id: "e2", from: "a", to: "b", kind: "sync", styleRefs: [] },
    ],
    groups: [],
    styles: [],
    diagnostics: [],
  };
}

describe("bidirectional LR edges", () => {
  it("routes both A↔B edges as short parallels in the layer corridor", async () => {
    const graph = mutual();
    const measured = measureGraph(graph).nodes;
    const { layout } = await layoutAndRouteWithElk(graph, measured, {
      direction: "LR",
      edgeNodeSpacing: 28,
      edgeEdgeSpacing: 8,
    });

    const a = layout.nodes.find((n) => n.nodeId === "a")!;
    const b = layout.nodes.find((n) => n.nodeId === "b")!;
    const left = b.bounds.x < a.bounds.x ? b : a;
    const right = left === a ? b : a;
    const corridorLeft = left.bounds.x + left.bounds.width;
    const corridorRight = right.bounds.x;

    expect(layout.edgePaths).toHaveLength(2);
    for (const path of layout.edgePaths) {
      // Straight (or one-jog) through the gap — not a loop around the cluster.
      expect(path.points.length).toBeLessThanOrEqual(4);
      const xs = path.points.map((p) => p.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      expect(minX).toBeGreaterThanOrEqual(corridorLeft - 1);
      expect(maxX).toBeLessThanOrEqual(corridorRight + 1);
    }

    // Enough vertical separation for two shafts + arrowheads.
    const y0 = layout.edgePaths[0]!.points[0]!.y;
    const y1 = layout.edgePaths[1]!.points[0]!.y;
    expect(Math.abs(y0 - y1)).toBeGreaterThanOrEqual(8);

    // Corridor wide enough to host arrowheads (not crushed by tight edge-only gaps).
    expect(corridorRight - corridorLeft).toBeGreaterThanOrEqual(24);
  });
});
