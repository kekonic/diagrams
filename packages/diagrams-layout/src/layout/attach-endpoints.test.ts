import { describe, expect, it } from "vite-plus/test";
import type { GraphModel } from "@kekonic/diagrams-core";
import { snapEdgeEndpointsToGeometry } from "./attach-endpoints.ts";
import type { LaidOutNode, LayoutEdgePath } from "./types.ts";

describe("snapEdgeEndpointsToGeometry", () => {
  it("pulls diamond endpoints onto the silhouette from AABB face hits", () => {
    const graph: GraphModel = {
      id: "d",
      nodes: [
        { id: "a", label: "A", kind: "choice", shape: "diamond", styleRefs: [] },
        { id: "b", label: "B", kind: "service", shape: "rounded", styleRefs: [] },
      ],
      edges: [{ id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] }],
      groups: [],
      styles: [],
      diagnostics: [],
    };
    const nodes: LaidOutNode[] = [
      { nodeId: "a", bounds: { x: 0, y: 0, width: 100, height: 100 }, rank: 0, order: 0 },
      { nodeId: "b", bounds: { x: 200, y: 30, width: 120, height: 40 }, rank: 1, order: 0 },
    ];
    // ELK-style hit on the diamond AABB east face below the tip (outside the fill).
    const paths: LayoutEdgePath[] = [
      {
        edgeId: "e1",
        points: [
          { x: 100, y: 70 },
          { x: 160, y: 70 },
          { x: 160, y: 50 },
          { x: 200, y: 50 },
        ],
      },
    ];
    const snapped = snapEdgeEndpointsToGeometry(graph, nodes, paths);
    const start = snapped[0]!.points[0]!;
    const end = snapped[0]!.points[snapped[0]!.points.length - 1]!;
    // Horizontal approach → diamond edge, not the AABB corner.
    expect(start.y).toBeCloseTo(70, 5);
    expect(start.x).toBeLessThan(100);
    expect(start.x).toBeGreaterThan(50);
    // Rounded target east←west: stays on left face.
    expect(end.x).toBeCloseTo(200, 5);
    expect(end.y).toBeCloseTo(50, 5);
  });

  it("orthifies a diagonal ELK tip instead of slashing to the port", () => {
    const graph: GraphModel = {
      id: "d",
      nodes: [
        { id: "a", label: "A", kind: "choice", shape: "diamond", styleRefs: [] },
        { id: "b", label: "B", kind: "service", shape: "rounded", styleRefs: [] },
      ],
      edges: [{ id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] }],
      groups: [],
      styles: [],
      diagnostics: [],
    };
    const nodes: LaidOutNode[] = [
      { nodeId: "a", bounds: { x: 0, y: 0, width: 120, height: 80 }, rank: 0, order: 0 },
      { nodeId: "b", bounds: { x: 40, y: 160, width: 200, height: 56 }, rank: 1, order: 0 },
    ];
    // Overshoot right, then diagonal back to the target top-center (the screenshot bug).
    const paths: LayoutEdgePath[] = [
      {
        edgeId: "e1",
        points: [
          { x: 90, y: 80 },
          { x: 90, y: 120 },
          { x: 180, y: 120 },
          { x: 140, y: 160 },
        ],
      },
    ];
    const snapped = snapEdgeEndpointsToGeometry(graph, nodes, paths);
    const pts = snapped[0]!.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      expect(Math.abs(a.x - b.x) < 0.75 || Math.abs(a.y - b.y) < 0.75).toBe(true);
    }
    const end = pts[pts.length - 1]!;
    expect(end.y).toBeCloseTo(160, 5);
  });

  it("leaves ERD column edges for snapErdEdgeEndpoints", () => {
    const graph: GraphModel = {
      id: "erd",
      nodes: [
        {
          id: "t1",
          label: "t1",
          kind: "table",
          shape: "table",
          columns: [{ name: "id", type: "uuid", keys: ["pk"] }],
          styleRefs: [],
        },
        {
          id: "t2",
          label: "t2",
          kind: "table",
          shape: "table",
          columns: [{ name: "t1_id", type: "uuid", keys: ["fk"] }],
          styleRefs: [],
        },
      ],
      edges: [
        {
          id: "fk",
          from: "t1",
          to: "t2",
          kind: "sync",
          fromColumn: "id",
          toColumn: "t1_id",
          styleRefs: [],
        },
      ],
      groups: [],
      styles: [],
      diagnostics: [],
    };
    const nodes: LaidOutNode[] = [
      { nodeId: "t1", bounds: { x: 0, y: 0, width: 180, height: 80 }, rank: 0, order: 0 },
      { nodeId: "t2", bounds: { x: 240, y: 0, width: 180, height: 80 }, rank: 1, order: 0 },
    ];
    const paths: LayoutEdgePath[] = [
      {
        edgeId: "fk",
        points: [
          { x: 180, y: 40 },
          { x: 240, y: 40 },
        ],
      },
    ];
    const snapped = snapEdgeEndpointsToGeometry(graph, nodes, paths);
    expect(snapped[0]!.points).toEqual(paths[0]!.points);
  });
});
