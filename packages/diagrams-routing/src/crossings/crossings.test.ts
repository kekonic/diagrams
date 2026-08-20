import { describe, expect, it } from "vite-plus/test";
import type { Point } from "@kekonic/diagrams-core";
import type { RoutedEdge } from "../routing/types.ts";
import {
  applyCrossingTreatment,
  trimEdgeEndpoints,
  flowArrowEnds,
  ARROW_ENDPOINT_INSET,
  EDGE_ENDPOINT_INSET,
  type TreatedEdge,
} from "./treat.ts";

function edge(id: string, from: Point, to: Point): RoutedEdge {
  return { edgeId: id, points: [from, to], segments: [{ from, to }] };
}

describe("crossing treatment", () => {
  const crossing = [
    edge("a", { x: 0, y: 50 }, { x: 100, y: 50 }),
    edge("b", { x: 50, y: 0 }, { x: 50, y: 100 }),
  ];

  it("passes through lines unchanged when mode is none", () => {
    const result = applyCrossingTreatment(crossing, "none");
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.segments.every((s) => s.type === "line"))).toBe(true);
  });

  it("inserts gap segments for gaps mode", () => {
    const result = applyCrossingTreatment(crossing, "gaps");
    const allTypes = result.flatMap((e) => e.segments.map((s) => s.type));
    expect(allTypes).toContain("gap");
  });

  it("inserts jump segments for jumps mode", () => {
    const result = applyCrossingTreatment(crossing, "jumps");
    const allTypes = result.flatMap((e) => e.segments.map((s) => s.type));
    expect(allTypes).toContain("jump");
  });

  it("uses smart mode with gap or jump at crossings", () => {
    const result = applyCrossingTreatment(crossing, "smart");
    const allTypes = result.flatMap((e) => e.segments.map((s) => s.type));
    expect(allTypes.some((t) => t === "gap" || t === "jump")).toBe(true);
  });

  it("smart mode uses jumps for an isolated crossing", () => {
    const result = applyCrossingTreatment(crossing, "smart");
    const allTypes = result.flatMap((e) => e.segments.map((s) => s.type));
    expect(allTypes).toContain("jump");
    expect(allTypes).not.toContain("gap");
  });

  it("smart mode uses gaps for a dense crossing cluster", () => {
    // Two verticals cross one horizontal within cluster distance.
    const dense: RoutedEdge[] = [
      edge("h", { x: 0, y: 50 }, { x: 200, y: 50 }),
      edge("v1", { x: 60, y: 0 }, { x: 60, y: 100 }),
      edge("v2", { x: 90, y: 0 }, { x: 90, y: 100 }),
    ];
    const result = applyCrossingTreatment(dense, "smart");
    const allTypes = result.flatMap((e) => e.segments.map((s) => s.type));
    expect(allTypes).toContain("gap");
    expect(allTypes).not.toContain("jump");
  });

  it("smart mode prefers gaps near polyline bends", () => {
    const bent: RoutedEdge[] = [
      edge("h", { x: 0, y: 50 }, { x: 200, y: 50 }),
      {
        edgeId: "v",
        points: [
          { x: 100, y: 0 },
          { x: 100, y: 40 },
          { x: 100, y: 100 },
        ],
        segments: [
          { from: { x: 100, y: 0 }, to: { x: 100, y: 40 } },
          { from: { x: 100, y: 40 }, to: { x: 100, y: 100 } },
        ],
      },
    ];
    // Crossing at (100,50) is 10px from bend (100,40) → gap
    const result = applyCrossingTreatment(bent, "smart");
    const allTypes = result.flatMap((e) => e.segments.map((s) => s.type));
    expect(allTypes).toContain("gap");
    expect(allTypes).not.toContain("jump");
  });
});

describe("trimEdgeEndpoints", () => {
  function treated(edgeId: string, from: Point, to: Point): TreatedEdge {
    return {
      edgeId,
      segments: [{ type: "line", from, to }],
    };
  }

  it("pulls target end back along the last segment for arrow edges", () => {
    const from = { x: 0, y: 50 };
    const to = { x: 100, y: 50 };
    const [result] = trimEdgeEndpoints([treated("e1", from, to)], {
      sourceInset: 0,
      targetInset: ARROW_ENDPOINT_INSET,
    });
    const line = result!.segments[0]!;
    expect(line.type).toBe("line");
    if (line.type !== "line") return;
    expect(line.from).toEqual(from);
    expect(line.to.x).toBeCloseTo(to.x - ARROW_ENDPOINT_INSET, 5);
    expect(line.to.y).toBe(to.y);
  });

  it("pulls source end forward along the first segment", () => {
    const from = { x: 0, y: 50 };
    const to = { x: 100, y: 50 };
    const [result] = trimEdgeEndpoints([treated("e1", from, to)], {
      sourceInset: EDGE_ENDPOINT_INSET,
      targetInset: 0,
    });
    const line = result!.segments[0]!;
    if (line.type !== "line") return;
    expect(line.from.x).toBeCloseTo(from.x + EDGE_ENDPOINT_INSET, 5);
    expect(line.to).toEqual(to);
  });

  it("caps inset on very short segments", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 10, y: 0 };
    const [result] = trimEdgeEndpoints([treated("e1", from, to)], {
      sourceInset: 0,
      targetInset: ARROW_ENDPOINT_INSET,
    });
    const line = result!.segments[0]!;
    if (line.type !== "line") return;
    expect(line.to.x).toBeGreaterThan(from.x);
    expect(line.to.x).toBeLessThan(to.x);
  });

  it("walks inset into the previous line when the last stub is shorter than the arrow", () => {
    const treatedEdge: TreatedEdge = {
      edgeId: "e1",
      segments: [
        { type: "line", from: { x: 0, y: 50 }, to: { x: 96, y: 50 } },
        { type: "line", from: { x: 96, y: 50 }, to: { x: 100, y: 50 } },
      ],
    };
    const [result] = trimEdgeEndpoints([treatedEdge], {
      sourceInset: 0,
      targetInset: ARROW_ENDPOINT_INSET,
    });
    const last = result!.segments[result!.segments.length - 1]!;
    expect(last.type).toBe("line");
    if (last.type !== "line") return;
    expect(last.to.x).toBeCloseTo(100 - ARROW_ENDPOINT_INSET, 5);
    expect(last.to.y).toBe(50);
  });

  it("trims a cubic terminal along its end tangent", () => {
    const treatedEdge: TreatedEdge = {
      edgeId: "e1",
      segments: [
        {
          type: "cubic",
          from: { x: 0, y: 50 },
          c1: { x: 40, y: 50 },
          c2: { x: 80, y: 50 },
          to: { x: 100, y: 50 },
        },
      ],
    };
    const [result] = trimEdgeEndpoints([treatedEdge], {
      sourceInset: 0,
      targetInset: ARROW_ENDPOINT_INSET,
    });
    const cubic = result!.segments[0]!;
    expect(cubic.type).toBe("cubic");
    if (cubic.type !== "cubic") return;
    expect(cubic.to.x).toBeCloseTo(100 - ARROW_ENDPOINT_INSET, 5);
    expect(cubic.to.y).toBe(50);
  });
});

describe("flowArrowEnds", () => {
  it("trims dependency edges the same way as sync arrows", () => {
    expect(flowArrowEnds({ kind: "dependency", arrows: "end" }, true)).toEqual({
      start: false,
      end: true,
    });
    expect(flowArrowEnds({ kind: "sync", arrows: "end" }, true)).toEqual({
      start: false,
      end: true,
    });
  });

  it("trims both ends for bidirectional arrows", () => {
    expect(flowArrowEnds({ kind: "sync", arrows: "both" }, true)).toEqual({
      start: true,
      end: true,
    });
  });

  it("skips association and arrowheads:none", () => {
    expect(flowArrowEnds({ kind: "association" }, true)).toEqual({ start: false, end: false });
    expect(flowArrowEnds({ kind: "sync", arrows: "none" }, true)).toEqual({
      start: false,
      end: false,
    });
  });
});

describe("crossing clearance near endpoints", () => {
  it("skips gaps that would orphan a stub near a segment end", () => {
    const edges = [
      {
        edgeId: "vert",
        points: [
          { x: 160, y: 0 },
          { x: 160, y: 200 },
        ],
        segments: [
          {
            from: { x: 160, y: 0 },
            to: { x: 160, y: 200 },
          },
        ],
      },
      {
        edgeId: "horiz",
        points: [
          { x: 180, y: 20 },
          { x: 40, y: 20 },
        ],
        segments: [
          {
            from: { x: 180, y: 20 },
            to: { x: 40, y: 20 },
          },
        ],
      },
    ];
    const treated = applyCrossingTreatment(edges, "gaps");
    const horiz = treated.find((e) => e.edgeId === "horiz")!;
    // Crossing at x=160 is only 20px from the start (180) — too close; keep a single line.
    expect(horiz.segments.every((s) => s.type === "line")).toBe(true);
    expect(horiz.segments).toHaveLength(1);
  });
});
