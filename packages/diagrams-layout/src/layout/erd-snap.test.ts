import { describe, expect, it } from "vite-plus/test";
import type { GraphModel } from "@kekonic/diagrams-core";
import { snapErdEdgeEndpoints, pickAttachmentSides } from "./erd-snap.ts";
import type { LayoutResult } from "./types.ts";

function erdPair(): GraphModel {
  return {
    id: "g",
    nodes: [
      {
        id: "a",
        label: "a",
        kind: "table",
        shape: "table",
        styleRefs: [],
        columns: [
          { name: "id", type: "uuid", keys: ["pk"] },
          { name: "name", type: "text", keys: [] },
        ],
      },
      {
        id: "b",
        label: "b",
        kind: "table",
        shape: "table",
        styleRefs: [],
        columns: [
          { name: "id", type: "uuid", keys: ["pk"] },
          { name: "a_id", type: "uuid", keys: ["fk"] },
        ],
      },
    ],
    edges: [
      {
        id: "e1",
        from: "a",
        to: "b",
        kind: "sync",
        styleRefs: [],
        fromColumn: "id",
        toColumn: "a_id",
        cardinality: { from: "one", to: "oneOrMany" },
      },
    ],
    groups: [],
    styles: [],
    diagnostics: [],
  };
}

function segmentHitsInterior(
  from: { x: number; y: number },
  to: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const eps = 0.75;
  if (Math.abs(from.y - to.y) < eps) {
    const y = from.y;
    if (y <= top + eps || y >= bottom - eps) return false;
    const x0 = Math.min(from.x, to.x);
    const x1 = Math.max(from.x, to.x);
    return x0 < right - eps && x1 > left + eps;
  }
  if (Math.abs(from.x - to.x) < eps) {
    const x = from.x;
    if (x <= left + eps || x >= right - eps) return false;
    const y0 = Math.min(from.y, to.y);
    const y1 = Math.max(from.y, to.y);
    return y0 < bottom - eps && y1 > top + eps;
  }
  return false;
}

describe("snapErdEdgeEndpoints", () => {
  it("snaps endpoints to column midlines (LR)", () => {
    const graph = erdPair();
    const layout: LayoutResult = {
      nodes: [
        { nodeId: "a", bounds: { x: 0, y: 0, width: 100, height: 68 }, rank: 0, order: 0 },
        { nodeId: "b", bounds: { x: 200, y: 0, width: 100, height: 68 }, rank: 1, order: 0 },
      ],
      groups: [],
      edgePaths: [
        {
          edgeId: "e1",
          points: [
            { x: 100, y: 34 },
            { x: 200, y: 34 },
          ],
        },
      ],
      edgeLabels: [],
      direction: "LR",
      algorithmVersion: "elk-layered-v1",
      layoutMs: 0,
      width: 300,
      height: 100,
    };

    const snapped = snapErdEdgeEndpoints(graph, layout, layout.edgePaths);
    const pts = snapped[0]!.points;
    // header 28 + row0 midline 10 = 38 for id; a_id is row 1 → 28+20+10 = 58
    expect(pts[0]!.y).toBe(38);
    expect(pts[pts.length - 1]!.y).toBe(58);
    expect(pts[0]!.x).toBe(100);
    expect(pts[pts.length - 1]!.x).toBe(200);
  });

  it("snaps to column rows on left/right faces under TD with horizontal separation", () => {
    const graph = erdPair();
    // Stack vertically with a clear horizontal offset so facing sides are unambiguous.
    const layout: LayoutResult = {
      nodes: [
        { nodeId: "a", bounds: { x: 0, y: 0, width: 100, height: 68 }, rank: 0, order: 0 },
        { nodeId: "b", bounds: { x: 120, y: 120, width: 100, height: 68 }, rank: 1, order: 0 },
      ],
      groups: [],
      edgePaths: [
        {
          edgeId: "e1",
          points: [
            { x: 50, y: 68 },
            { x: 170, y: 120 },
          ],
        },
      ],
      edgeLabels: [],
      direction: "TD",
      algorithmVersion: "elk-layered-v1",
      layoutMs: 0,
      width: 240,
      height: 200,
    };

    const snapped = snapErdEdgeEndpoints(graph, layout, layout.edgePaths);
    const pts = snapped[0]!.points;
    expect(pts[0]!.y).toBe(38);
    expect(pts[pts.length - 1]!.y).toBe(120 + 58);
    // Still left/right faces (ERD convention), not top/bottom centers.
    expect(pts[0]!.x).toBe(100);
    expect(pts[pts.length - 1]!.x).toBe(120);
  });

  it("routes around vertically stacked tables instead of through them", () => {
    const graph = erdPair();
    const aBounds = { x: 100, y: 0, width: 200, height: 108 };
    const bBounds = { x: 93, y: 160, width: 213, height: 128 };
    const layout: LayoutResult = {
      nodes: [
        { nodeId: "a", bounds: aBounds, rank: 0, order: 0 },
        { nodeId: "b", bounds: bBounds, rank: 1, order: 0 },
      ],
      groups: [],
      edgePaths: [
        {
          edgeId: "e1",
          points: [
            { x: 100, y: 38 },
            { x: 200, y: 38 },
            { x: 200, y: 238 },
            { x: 306, y: 238 },
          ],
        },
      ],
      edgeLabels: [],
      direction: "TD",
      algorithmVersion: "elk-layered-v1",
      layoutMs: 0,
      width: 400,
      height: 320,
    };

    const sides = pickAttachmentSides(aBounds, bBounds, layout.edgePaths[0]!.points);
    expect(sides.fromSide).toBe(sides.toSide);

    const snapped = snapErdEdgeEndpoints(graph, layout, layout.edgePaths);
    const pts = snapped[0]!.points;
    expect(pts[0]!.y).toBe(38);
    expect(pts[pts.length - 1]!.y).toBe(160 + 58);

    for (let i = 0; i < pts.length - 1; i++) {
      expect(segmentHitsInterior(pts[i]!, pts[i + 1]!, aBounds)).toBe(false);
      expect(segmentHitsInterior(pts[i]!, pts[i + 1]!, bBounds)).toBe(false);
    }
  });
});
