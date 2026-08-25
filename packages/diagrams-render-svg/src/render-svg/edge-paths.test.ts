import { describe, expect, it } from "vite-plus/test";
import type { Point } from "@kekonic/diagrams-core";
import { edgeStrokePath } from "./edge-paths.ts";

describe("edgeStrokePath", () => {
  const segments = [
    { type: "line" as const, from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
    { type: "line" as const, from: { x: 100, y: 0 }, to: { x: 100, y: 80 } },
  ];

  it("builds metro corners by default", () => {
    const path = edgeStrokePath(segments);
    expect(path).toContain("C");
    expect(path.startsWith("M 0 0")).toBe(true);
  });

  it("builds an orthogonal polyline when requested", () => {
    const path = edgeStrokePath(segments, { route: "orthogonal" });
    expect(path).toMatch(/^M 0 0 L 100 0 L 100 80$/);
  });

  it("builds rounded corners with cubic commands", () => {
    const path = edgeStrokePath(segments, { route: "rounded", cornerRadius: 10 });
    expect(path).toContain("C");
    expect(path.startsWith("M 0 0")).toBe(true);
  });

  it("builds bezier curves for two-point paths", () => {
    const path = edgeStrokePath([{ type: "line", from: { x: 0, y: 0 }, to: { x: 120, y: 0 } }], {
      route: "bezier",
    });
    expect(path).toMatch(/^M 0 0 C /);
  });

  it("breaks the stroke at gap segments instead of drawing through them", () => {
    const withGap = [
      { type: "line" as const, from: { x: 0, y: 0 }, to: { x: 40, y: 0 } },
      { type: "gap" as const, from: { x: 40, y: 0 }, to: { x: 60, y: 0 } },
      { type: "line" as const, from: { x: 60, y: 0 }, to: { x: 100, y: 0 } },
    ];
    const path = edgeStrokePath(withGap, { route: "orthogonal" });
    expect(path).toBe("M 0 0 L 40 0 L 100 0");
    expect(path).not.toMatch(/L 60 0/);
  });

  it("serializes cubic segments as C commands", () => {
    const path = edgeStrokePath(
      [
        {
          type: "cubic",
          from: { x: 0, y: 0 },
          c1: { x: 40, y: 0 },
          c2: { x: 80, y: 40 },
          to: { x: 80, y: 80 },
        },
      ],
      { route: "bezier" },
    );
    expect(path).toMatch(/^M 0 0 C 40 0 80 40 80 80$/);
  });

  it("returns empty string when fewer than two points remain", () => {
    expect(edgeStrokePath([])).toBe("");
    expect(
      edgeStrokePath([{ type: "gap", from: { x: 0, y: 0 } as Point, to: { x: 1, y: 1 } }]),
    ).toBe("");
  });
});
