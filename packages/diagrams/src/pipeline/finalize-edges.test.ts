import { describe, expect, it } from "vite-plus/test";
import type { Point, Rect } from "@kekonic/diagrams-core";
import type { TextMeasurer, TextStyle, WrapOptions } from "@kekonic/diagrams-layout";
import { placeEdgeLabel } from "./finalize-edges.ts";

const fixedMeasurer: TextMeasurer = {
  measureText(text: string, style: TextStyle) {
    const width = text.length * style.fontSize * 0.55;
    const height = style.fontSize * 1.2;
    return { width, height, ascent: height * 0.8, descent: height * 0.2 };
  },
  wrapText(text: string, options: WrapOptions) {
    const m = fixedMeasurer.measureText(text, options.style);
    return { lines: [text], width: m.width, height: m.height };
  },
};

describe("placeEdgeLabel", () => {
  const longPath: Point[] = [
    { x: 0, y: 50 },
    { x: 200, y: 50 },
  ];

  it("sizes the pill from TextMeasurer metrics instead of char*6.4", () => {
    const wide = placeEdgeLabel("e1", "WWWWWWWWWW", longPath, [], [], {
      measurer: fixedMeasurer,
    });
    const narrow = placeEdgeLabel("e2", "iiiiiiiiii", longPath, [], [], {
      measurer: {
        ...fixedMeasurer,
        measureText(text: string, style: TextStyle) {
          // Force much narrower metrics for "i" than "W"
          const width = text.length * style.fontSize * 0.2;
          const height = style.fontSize * 1.2;
          return { width, height, ascent: height * 0.8, descent: height * 0.2 };
        },
      },
    });
    expect(wide.bounds.width).toBeGreaterThan(narrow.bounds.width);
  });

  it("prefers anchors away from path endpoints / arrowheads", () => {
    const placed = placeEdgeLabel("e1", "mid", longPath, [], [], { measurer: fixedMeasurer });
    // Mid-ish of the 200px segment — not within soft clearance of either end.
    expect(placed.anchor.x).toBeGreaterThan(36);
    expect(placed.anchor.x).toBeLessThan(164);
  });

  it("prefers placements that miss node cards", () => {
    const nodeOverMid: Rect = { x: 70, y: 30, width: 60, height: 40 };
    const placed = placeEdgeLabel("e1", "go", longPath, [nodeOverMid], [], {
      measurer: fixedMeasurer,
    });
    const overlaps =
      placed.bounds.x < nodeOverMid.x + nodeOverMid.width &&
      placed.bounds.x + placed.bounds.width > nodeOverMid.x &&
      placed.bounds.y < nodeOverMid.y + nodeOverMid.height &&
      placed.bounds.y + placed.bounds.height > nodeOverMid.y;
    expect(overlaps).toBe(false);
  });

  it("penalizes candidates that sit on crossing points", () => {
    // Without crossing: mid is fine. With crossing at mid, should shift.
    const crossing: Point[] = [{ x: 100, y: 50 }];
    const placed = placeEdgeLabel("e1", "x", longPath, [], [], {
      measurer: fixedMeasurer,
      crossings: crossing,
    });
    const midDist = Math.hypot(placed.anchor.x - 100, placed.anchor.y - 50);
    // Anchor itself may stay near mid while bounds offset; require clearance from crossing to bounds.
    const cx = Math.min(Math.max(100, placed.bounds.x), placed.bounds.x + placed.bounds.width);
    const cy = Math.min(Math.max(50, placed.bounds.y), placed.bounds.y + placed.bounds.height);
    const toBounds = Math.hypot(100 - cx, 50 - cy);
    expect(toBounds + midDist).toBeGreaterThan(0);
    // Prefer not covering the crossing with the pill interior.
    const covers =
      100 > placed.bounds.x + 2 &&
      100 < placed.bounds.x + placed.bounds.width - 2 &&
      50 > placed.bounds.y + 2 &&
      50 < placed.bounds.y + placed.bounds.height - 2;
    expect(covers).toBe(false);
  });

  it("avoids parking on a sharp corner when a longer free segment exists", () => {
    const bent: Point[] = [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 150 },
    ];
    const placed = placeEdgeLabel("e1", "turn", bent, [], [], { measurer: fixedMeasurer });
    const bend = { x: 100, y: 50 };
    const d = Math.hypot(placed.anchor.x - bend.x, placed.anchor.y - bend.y);
    expect(d).toBeGreaterThan(12);
  });

  it("honors authored labelPosition along the path", () => {
    // Long L: horizontal then vertical — start/end should land on different arms.
    const bent: Point[] = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
    ];
    const nearStart = placeEdgeLabel("e1", "start", bent, [], [], {
      measurer: fixedMeasurer,
      position: "start",
      authoredPosition: true,
    });
    const nearEnd = placeEdgeLabel("e2", "end", bent, [], [], {
      measurer: fixedMeasurer,
      position: "end",
      authoredPosition: true,
    });
    const mid = placeEdgeLabel("e3", "mid", bent, [], [], {
      measurer: fixedMeasurer,
      position: "middle",
      authoredPosition: true,
    });
    // Start prefers the early horizontal run (low x, y≈0).
    expect(nearStart.anchor.x).toBeLessThan(160);
    expect(nearStart.anchor.y).toBeLessThan(40);
    // End prefers the late vertical run (x≈300, high y).
    expect(nearEnd.anchor.x).toBeGreaterThan(250);
    expect(nearEnd.anchor.y).toBeGreaterThan(140);
    // Middle sits nearer the bend / mid-path than either extreme.
    const startDist = Math.hypot(
      mid.anchor.x - nearStart.anchor.x,
      mid.anchor.y - nearStart.anchor.y,
    );
    const endDist = Math.hypot(mid.anchor.x - nearEnd.anchor.x, mid.anchor.y - nearEnd.anchor.y);
    expect(startDist).toBeGreaterThan(40);
    expect(endDist).toBeGreaterThan(40);
  });

  it("keeps the label pill close to the path stroke", () => {
    const path: Point[] = [
      { x: 0, y: 100 },
      { x: 400, y: 100 },
    ];
    // Tall endpoints used to tempt parking into empty vertical space.
    const endpoints: Rect[] = [
      { x: 0, y: 0, width: 40, height: 200 },
      { x: 360, y: 0, width: 40, height: 200 },
    ];
    const placed = placeEdgeLabel("e1", "near", path, [], endpoints, {
      measurer: fixedMeasurer,
    });
    const cy = placed.bounds.y + placed.bounds.height / 2;
    expect(Math.abs(cy - 100)).toBeLessThan(40);
    expect(placed.anchor.y).toBeCloseTo(100, 0);
  });
});
