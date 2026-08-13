import { describe, expect, it } from "vite-plus/test";
import { clampEdgeLabels } from "./labels.ts";

describe("clampEdgeLabels", () => {
  it("nudges labels inside content bounds", () => {
    const labels = [
      {
        edgeId: "e1",
        text: "Reserve",
        bounds: { x: 100, y: -5, width: 80, height: 28 },
        anchor: { x: 140, y: 9 },
      },
    ];
    const clamped = clampEdgeLabels(labels, { x: 0, y: 0, width: 400, height: 200 }, true);
    expect(clamped[0]!.bounds.y).toBeGreaterThanOrEqual(4);
  });

  it("passes through when disabled", () => {
    const labels = [
      {
        edgeId: "e1",
        text: "Reserve",
        bounds: { x: 100, y: -5, width: 80, height: 28 },
        anchor: { x: 140, y: 9 },
      },
    ];
    expect(
      clampEdgeLabels(labels, { x: 0, y: 0, width: 400, height: 200 }, false)[0]!.bounds.y,
    ).toBe(-5);
  });

  it("nudges labels off node keep-out rects", () => {
    const labels = [
      {
        edgeId: "e1",
        text: "customer_id → id",
        bounds: { x: 120, y: 40, width: 118, height: 18 },
        anchor: { x: 179, y: 49 },
      },
    ];
    const keepOut = [{ x: 100, y: 20, width: 200, height: 100 }];
    const clamped = clampEdgeLabels(labels, { x: 0, y: 0, width: 500, height: 300 }, true, keepOut);
    const b = clamped[0]!.bounds;
    const overlaps =
      b.x < keepOut[0]!.x + keepOut[0]!.width &&
      b.x + b.width > keepOut[0]!.x &&
      b.y < keepOut[0]!.y + keepOut[0]!.height &&
      b.y + b.height > keepOut[0]!.y;
    expect(overlaps).toBe(false);
  });
});
