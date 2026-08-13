import { describe, expect, it } from "vite-plus/test";
import { attachPointOnPerimeter } from "./perimeter.ts";

describe("attachPointOnPerimeter", () => {
  it("hits diamond north tip from center", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const pt = attachPointOnPerimeter({
      shapeId: "diamond",
      bounds,
      origin: { x: 50, y: 50 },
      direction: { x: 0, y: -1 },
    });
    expect(pt.x).toBeCloseTo(50, 5);
    expect(pt.y).toBeCloseTo(0, 5);
  });

  it("hits rectangle east face", () => {
    const bounds = { x: 10, y: 20, width: 80, height: 40 };
    const pt = attachPointOnPerimeter({
      shapeId: "rectangle",
      bounds,
      origin: { x: 50, y: 40 },
      direction: { x: 1, y: 0 },
    });
    expect(pt.x).toBeCloseTo(90, 5);
    expect(pt.y).toBeCloseTo(40, 5);
  });
});
