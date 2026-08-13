import { describe, expect, it } from "vite-plus/test";
import type { Point, Rect } from "@kekonic/diagrams-core";
import {
  clearOrthogonalCorridors,
  collapseColinearPoints,
  polishEdgePaths,
} from "./polish-edges.ts";
import { elkPriorityOptionsForEdge, layoutBranchCue } from "./edge-priority.ts";

describe("polish-edges", () => {
  it("collapses colinear waypoints", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: 20 },
      { x: 5, y: 20 },
    ];
    expect(collapseColinearPoints(points)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: 5, y: 20 },
    ]);
  });

  it("pushes a flush vertical jog away from a node face", () => {
    const node: Rect = { x: 0, y: 0, width: 100, height: 80 };
    // Attach on right face, then a near-flush vertical corridor, then right.
    const points: Point[] = [
      { x: 100, y: 40 },
      { x: 104, y: 40 },
      { x: 104, y: 10 },
      { x: 200, y: 10 },
    ];
    const cleared = clearOrthogonalCorridors(points, [node], 28);
    expect(cleared[0]).toEqual({ x: 100, y: 40 }); // attach stays
    expect(cleared[1]!.x).toBe(128); // 100 + 28
    expect(cleared[2]!.x).toBe(128);
    expect(cleared[3]).toEqual({ x: 200, y: 10 });
  });

  it("polishEdgePaths keeps attach points and clears flush corners", () => {
    const node: Rect = { x: 0, y: 0, width: 100, height: 80 };
    const polished = polishEdgePaths(
      [
        {
          edgeId: "e1",
          points: [
            { x: 100, y: 40 },
            { x: 103, y: 40 },
            { x: 103, y: 70 },
            { x: 180, y: 70 },
          ],
        },
      ],
      [node],
      28,
    );
    const pts = polished[0]!.points;
    expect(pts[0]).toEqual({ x: 100, y: 40 });
    expect(pts.some((p) => p.x === 128)).toBe(true);
  });

  it("does not diagonalize the final stub when clearing corridors", () => {
    const target: Rect = { x: 40, y: 160, width: 200, height: 56 };
    const points: Point[] = [
      { x: 90, y: 80 },
      { x: 90, y: 120 },
      { x: 180, y: 120 },
      { x: 180, y: 160 },
      { x: 140, y: 160 },
    ];
    const polished = polishEdgePaths([{ edgeId: "e1", points }], [target], 28);
    const pts = polished[0]!.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      expect(Math.abs(a.x - b.x) < 0.75 || Math.abs(a.y - b.y) < 0.75).toBe(true);
    }
  });
});

describe("edge-priority", () => {
  it("classifies affirmative and negative cues", () => {
    expect(layoutBranchCue({ label: "Yes" })).toBe("yes");
    expect(layoutBranchCue({ label: "OK" })).toBe("yes");
    expect(layoutBranchCue({ label: "no" })).toBe("no");
    expect(layoutBranchCue({ label: "Damaged" })).toBe("neutral");
    expect(layoutBranchCue({ label: "No", branch: "yes" })).toBe("yes");
  });

  it("prioritizes straight happy-path and short exceptions", () => {
    const yes = elkPriorityOptionsForEdge({
      id: "e1",
      from: "a",
      to: "b",
      label: "Yes",
      kind: "sync",
      styleRefs: [],
      branch: "yes",
    });
    const no = elkPriorityOptionsForEdge({
      id: "e2",
      from: "a",
      to: "c",
      label: "No",
      kind: "sync",
      styleRefs: [],
      branch: "no",
    });
    expect(Number(yes["elk.layered.priority.straightness"])).toBeGreaterThan(
      Number(no["elk.layered.priority.straightness"]),
    );
    expect(Number(no["elk.layered.priority.shortness"])).toBeGreaterThan(
      Number(yes["elk.layered.priority.shortness"]),
    );
  });
});
