import { describe, expect, it } from "vite-plus/test";
import type { Point, Rect } from "@kekonic/diagrams-core";
import {
  collapseColinear,
  cubicsToPath,
  fitOrganicRoute,
  fitSmartBezier,
  refineRouteStyle,
  sampleCubics,
  segmentHitsAabb,
  shortcutStraight,
  type RouteStyleEdge,
  type RouteStyleObstacle,
} from "./path-style.ts";

const box = (id: string, x: number, y: number, w: number, h: number): RouteStyleObstacle => ({
  id,
  bounds: { x, y, width: w, height: h },
});

function elbow(): Point[] {
  return [
    { x: 80, y: 40 },
    { x: 140, y: 40 },
    { x: 140, y: 120 },
  ];
}

function uTurn(): Point[] {
  return [
    { x: 20, y: 40 },
    { x: 60, y: 40 },
    { x: 60, y: 10 },
    { x: 180, y: 10 },
    { x: 180, y: 40 },
    { x: 220, y: 40 },
  ];
}

function nearestDist(samples: Point[], p: Point): number {
  return Math.min(...samples.map((s) => Math.hypot(s.x - p.x, s.y - p.y)));
}

describe("segmentHitsAabb", () => {
  const node: Rect = { x: 40, y: 40, width: 80, height: 40 };

  it("detects a diagonal that stabs the interior", () => {
    expect(segmentHitsAabb({ x: 0, y: 0 }, { x: 200, y: 120 }, node)).toBe(true);
  });

  it("ignores a chord that only kisses a face", () => {
    expect(segmentHitsAabb({ x: 0, y: 40 }, { x: 200, y: 40 }, node)).toBe(false);
  });

  it("ignores a corridor that misses the box", () => {
    expect(segmentHitsAabb({ x: 0, y: 10 }, { x: 200, y: 10 }, node)).toBe(false);
  });
});

describe("shortcutStraight", () => {
  it("collapses a clear elbow to a port-to-port chord", () => {
    const points = shortcutStraight(elbow(), []);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ x: 80, y: 40 });
    expect(points[1]).toEqual({ x: 140, y: 120 });
  });

  it("keeps a dogleg when the chord would punch a node", () => {
    const blocker: Rect = { x: 90, y: 50, width: 40, height: 50 };
    const points = shortcutStraight(elbow(), [blocker]);
    expect(points.length).toBeGreaterThan(2);
    expect(segmentHitsAabb(points[0]!, points[points.length - 1]!, blocker)).toBe(true);
    for (let i = 0; i < points.length - 1; i++) {
      expect(segmentHitsAabb(points[i]!, points[i + 1]!, blocker)).toBe(false);
    }
  });

  it("drops colinear stubs before shortcutting", () => {
    const pts = collapseColinear([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 20 },
    ]);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 20 },
    ]);
  });
});

describe("fitSmartBezier", () => {
  it("fits one cubic through a clear elbow using port-normal handles", () => {
    const cubics = fitSmartBezier(elbow(), []);
    expect(cubics).toHaveLength(1);
    const c = cubics[0]!;
    expect(c.from).toEqual({ x: 80, y: 40 });
    expect(c.to).toEqual({ x: 140, y: 120 });
    // Exit along the first stub (horizontal), arrive along the last stub (vertical).
    expect(c.c1.y).toBeCloseTo(40, 5);
    expect(c.c1.x).toBeGreaterThan(80);
    expect(c.c2.x).toBeCloseTo(140, 5);
    expect(c.c2.y).toBeLessThan(120);
  });

  it("splits around a node instead of punching it", () => {
    const blocker: Rect = { x: 95, y: 50, width: 40, height: 50 };
    const cubics = fitSmartBezier(elbow(), [blocker]);
    expect(cubics.length).toBeGreaterThan(1);
    const samples = sampleCubics(cubics, 20);
    for (let i = 0; i < samples.length - 1; i++) {
      expect(segmentHitsAabb(samples[i]!, samples[i + 1]!, blocker)).toBe(false);
    }
  });

  it("follows a U-shaped back-edge instead of a naive center cubic", () => {
    const blocker: Rect = { x: 80, y: 20, width: 80, height: 50 };
    const cubics = fitSmartBezier(uTurn(), [blocker]);
    expect(cubics.length).toBeGreaterThan(1);
    const samples = sampleCubics(cubics, 16);
    for (let i = 0; i < samples.length - 1; i++) {
      expect(segmentHitsAabb(samples[i]!, samples[i + 1]!, blocker)).toBe(false);
    }
    expect(cubicsToPath(cubics)).toMatch(/^M .+ C /);
  });

  it("is deterministic for identical input", () => {
    const a = cubicsToPath(fitSmartBezier(elbow(), []));
    const b = cubicsToPath(fitSmartBezier(elbow(), []));
    expect(a).toBe(b);
  });
});

describe("fitOrganicRoute", () => {
  it("eases out of the start port and into the end port", () => {
    const cubics = fitOrganicRoute(elbow(), [], {
      mode: "metro",
      t0: { x: 1, y: 0 },
      t1: { x: 0, y: 1 },
    });
    expect(cubics.length).toBeGreaterThanOrEqual(1);
    const first = cubics[0]!;
    const last = cubics[cubics.length - 1]!;
    expect(first.from).toEqual({ x: 80, y: 40 });
    expect(last.to).toEqual({ x: 140, y: 120 });
    expect(first.c1.x).toBeGreaterThan(first.from.x);
    expect(Math.abs(first.c1.y - first.from.y)).toBeLessThan(1);
    expect(last.c2.x).toBeCloseTo(last.to.x, 5);
    expect(last.c2.y).toBeLessThan(last.to.y);
  });

  it("cuts avoidance elbows instead of passing through sharp 90° vertices", () => {
    const blocker: Rect = { x: 80, y: 20, width: 80, height: 50 };
    const cubics = fitOrganicRoute(uTurn(), [blocker], { mode: "metro" });
    expect(cubics.length).toBeGreaterThan(1);
    const samples = sampleCubics(cubics, 24);
    const elbows = [
      { x: 60, y: 40 },
      { x: 60, y: 10 },
      { x: 180, y: 10 },
      { x: 180, y: 40 },
    ];
    for (const elbowPt of elbows) {
      expect(nearestDist(samples, elbowPt)).toBeGreaterThan(5);
    }
    for (let i = 0; i < samples.length - 1; i++) {
      expect(segmentHitsAabb(samples[i]!, samples[i + 1]!, blocker)).toBe(false);
    }
  });

  it("rounds middle corridor elbows with a generous fillet radius", () => {
    const pts = [
      { x: 0, y: 40 },
      { x: 80, y: 40 },
      { x: 80, y: 120 },
      { x: 200, y: 120 },
    ];
    const cubics = fitOrganicRoute(pts, [], {
      mode: "metro",
      t0: { x: 1, y: 0 },
      t1: { x: 1, y: 0 },
    });
    const samples = sampleCubics(cubics, 24);
    expect(nearestDist(samples, { x: 80, y: 40 })).toBeGreaterThan(12);
    expect(nearestDist(samples, { x: 80, y: 120 })).toBeGreaterThan(12);
  });

  it("uses a generous start handle even on a short exit stub", () => {
    const pts = [
      { x: 80, y: 40 },
      { x: 92, y: 40 },
      { x: 92, y: 140 },
    ];
    const cubics = fitOrganicRoute(pts, [], {
      mode: "metro",
      t0: { x: 1, y: 0 },
      t1: { x: 0, y: 1 },
    });
    const first = cubics[0]!;
    expect(first.c1.x - first.from.x).toBeGreaterThanOrEqual(22);
  });

  it("eases a 2-point offset chord using port normals, not a diagonal", () => {
    const cubics = fitOrganicRoute(
      [
        { x: 80, y: 40 },
        { x: 160, y: 120 },
      ],
      [],
      { mode: "metro", t0: { x: 1, y: 0 }, t1: { x: 1, y: 0 } },
    );
    expect(cubics).toHaveLength(1);
    const c = cubics[0]!;
    expect(c.c1.y).toBeCloseTo(40, 5);
    expect(c.c1.x).toBeGreaterThan(80);
    expect(c.c2.y).toBeCloseTo(120, 5);
    expect(c.c2.x).toBeLessThan(160);
  });
});

describe("refineRouteStyle", () => {
  const nodes = [box("a", 0, 20, 80, 40), box("b", 160, 100, 80, 40)];
  const edges: RouteStyleEdge[] = [
    {
      edgeId: "a__b",
      fromId: "a",
      toId: "b",
      points: [
        { x: 80, y: 40 },
        { x: 140, y: 40 },
        { x: 140, y: 120 },
        { x: 160, y: 120 },
      ],
    },
  ];

  it("keeps orthogonal geometry sharp with no cubics", () => {
    const out = refineRouteStyle(edges, nodes, "orthogonal");
    expect(out[0]!.points).toEqual(edges[0]!.points);
    expect(out[0]!.cubics).toBeUndefined();
  });

  it("attaches metro cubics that ease at the ports and keep the corridor points", () => {
    const out = refineRouteStyle(edges, nodes, "metro");
    expect(out[0]!.points).toEqual(edges[0]!.points);
    expect(out[0]!.cubics?.length).toBeGreaterThanOrEqual(1);
    const cubics = out[0]!.cubics!;
    expect(cubics[0]!.from).toEqual({ x: 80, y: 40 });
    expect(cubics[cubics.length - 1]!.to).toEqual({ x: 160, y: 120 });
    expect(cubics[0]!.c1.x).toBeGreaterThan(80);
  });

  it("straightens a clear corridor onto the port anchors", () => {
    const out = refineRouteStyle(edges, nodes, "straight");
    expect(out[0]!.points).toHaveLength(2);
    expect(out[0]!.points[0]).toEqual({ x: 80, y: 40 });
    expect(out[0]!.points[1]).toEqual({ x: 160, y: 120 });
  });

  it("does not straighten through a third-party node", () => {
    const blocked = refineRouteStyle(edges, [...nodes, box("c", 100, 50, 50, 50)], "straight");
    expect(blocked[0]!.points.length).toBeGreaterThan(2);
  });

  it("keeps self-loop corridors intact", () => {
    const loop: RouteStyleEdge[] = [
      {
        edgeId: "a__a",
        fromId: "a",
        toId: "a",
        points: [
          { x: 80, y: 30 },
          { x: 110, y: 30 },
          { x: 110, y: 10 },
          { x: 40, y: 10 },
          { x: 40, y: 30 },
          { x: 0, y: 30 },
        ],
      },
    ];
    const out = refineRouteStyle(loop, nodes, "straight");
    expect(out[0]!.points).toHaveLength(loop[0]!.points.length);
  });

  it("offsets coincident straight edges when parallel is separate", () => {
    const twins: RouteStyleEdge[] = [
      {
        edgeId: "e1",
        fromId: "a",
        toId: "b",
        points: [
          { x: 0, y: 10 },
          { x: 100, y: 10 },
        ],
      },
      {
        edgeId: "e2",
        fromId: "a",
        toId: "b",
        points: [
          { x: 0, y: 10 },
          { x: 100, y: 10 },
        ],
      },
    ];
    const out = refineRouteStyle(twins, nodes, "straight", "separate");
    expect(out[0]!.points.length).toBe(3);
    expect(out[1]!.points.length).toBe(3);
    expect(out[0]!.points[1]!.y).not.toBeCloseTo(out[1]!.points[1]!.y, 5);
    expect(out[0]!.points[0]).toEqual({ x: 0, y: 10 });
    expect(out[0]!.points[2]).toEqual({ x: 100, y: 10 });
  });

  it("does not offset coincident edges when parallel is shared", () => {
    const twins: RouteStyleEdge[] = [
      {
        edgeId: "e1",
        fromId: "a",
        toId: "b",
        points: [
          { x: 0, y: 10 },
          { x: 100, y: 10 },
        ],
      },
      {
        edgeId: "e2",
        fromId: "a",
        toId: "b",
        points: [
          { x: 0, y: 10 },
          { x: 100, y: 10 },
        ],
      },
    ];
    const out = refineRouteStyle(twins, nodes, "straight", "shared");
    expect(out.every((e) => e.points.length === 2)).toBe(true);
  });

  it("attaches bezier cubics that start and end on the port anchors", () => {
    const out = refineRouteStyle(edges, nodes, "bezier");
    expect(out[0]!.cubics?.length).toBeGreaterThanOrEqual(1);
    const cubics = out[0]!.cubics!;
    expect(cubics[0]!.from).toEqual({ x: 80, y: 40 });
    expect(cubics[cubics.length - 1]!.to).toEqual({ x: 160, y: 120 });
    expect(out[0]!.points.length).toBeGreaterThan(2);
  });
});
