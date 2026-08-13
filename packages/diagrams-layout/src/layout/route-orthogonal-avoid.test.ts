import { describe, expect, it } from "vite-plus/test";
import {
  routeOrthogonalAvoiding,
  segmentHitsRect,
  segmentHugsRect,
} from "./route-orthogonal-avoid.ts";

describe("routeOrthogonalAvoiding", () => {
  it("detects vertical segment through a rect", () => {
    const box = { x: 10, y: 10, width: 40, height: 40 };
    expect(segmentHitsRect({ x: 30, y: 0 }, { x: 30, y: 80 }, box)).toBe(true);
    expect(segmentHitsRect({ x: 0, y: 0 }, { x: 0, y: 80 }, box)).toBe(false);
  });

  it("detects segments that hug a box face", () => {
    const box = { x: 100, y: 100, width: 80, height: 60 };
    expect(segmentHugsRect({ x: 180, y: 80 }, { x: 180, y: 200 }, box)).toBe(true);
    expect(segmentHugsRect({ x: 210, y: 80 }, { x: 210, y: 200 }, box)).toBe(false);
  });

  it("routes around a blocking node between source and target", () => {
    const from = { x: 0, y: 0, width: 40, height: 40 };
    const to = { x: 0, y: 200, width: 40, height: 40 };
    const blocker = { x: 0, y: 80, width: 40, height: 40 };
    const path = routeOrthogonalAvoiding(from, to, [blocker], 12);
    for (let i = 0; i < path.length - 1; i++) {
      expect(
        segmentHitsRect(path[i]!, path[i + 1]!, {
          x: blocker.x - 12,
          y: blocker.y - 12,
          width: blocker.width + 24,
          height: blocker.height + 24,
        }),
      ).toBe(false);
    }
    expect(path.length).toBeGreaterThanOrEqual(2);
  });

  it("does not run long corridors along the source or target face", () => {
    const from = { x: 0, y: 100, width: 80, height: 40 };
    const to = { x: 200, y: 0, width: 80, height: 40 };
    const path = routeOrthogonalAvoiding(from, to, [], 12);
    for (let i = 0; i < path.length - 1; i++) {
      const isStub = i === 0 || i === path.length - 2;
      expect(segmentHugsRect(path[i]!, path[i + 1]!, from, 16, isStub)).toBe(false);
      expect(segmentHugsRect(path[i]!, path[i + 1]!, to, 16, isStub)).toBe(false);
    }
  });

  it("exits south around a stacked blocker instead of hugging the source", () => {
    // Layered checkout → db with catalog stacked under checkout.
    const from = { x: 412, y: 345, width: 158, height: 69 };
    const to = { x: 332, y: 771, width: 122, height: 105 };
    const blocker = { x: 412, y: 542, width: 146, height: 69 };
    const path = routeOrthogonalAvoiding(from, to, [blocker], 12);
    const start = path[0]!;
    // Prefer the south face (primary) over a mid-body west exit.
    expect(Math.abs(start.y - (from.y + from.height))).toBeLessThan(1);
    for (let i = 0; i < path.length - 1; i++) {
      const isStub = i === 0 || i === path.length - 2;
      expect(segmentHugsRect(path[i]!, path[i + 1]!, from, 24, isStub)).toBe(false);
      expect(
        segmentHitsRect(path[i]!, path[i + 1]!, {
          x: blocker.x - 12,
          y: blocker.y - 12,
          width: blocker.width + 24,
          height: blocker.height + 24,
        }),
      ).toBe(false);
    }
  });

  it("uses a short south→north stub across a tight pack wrap gap", () => {
    // arrange: pack leaves CELL_GAP=16 between wrapped rows; default turn (~36)
    // used to overshoot into the target and escape west around the hull.
    const from = { x: 108, y: 396, width: 155, height: 93 };
    const to = { x: 108, y: 505, width: 146, height: 56 };
    const sibling = { x: 279, y: 414, width: 146, height: 56 };
    const path = routeOrthogonalAvoiding(from, to, [sibling], 12);
    const start = path[0]!;
    const end = path[path.length - 1]!;
    expect(Math.abs(start.y - (from.y + from.height))).toBeLessThan(1);
    expect(Math.abs(end.y - to.y)).toBeLessThan(1);
    const len = path.reduce((acc, p, i) => {
      if (i === 0) return 0;
      const prev = path[i - 1]!;
      return acc + Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
    }, 0);
    expect(len).toBeLessThan(80);
  });

  it("uses a short east→west stub across a tight horizontal pack gap", () => {
    const from = { x: 0, y: 0, width: 100, height: 50 };
    const to = { x: 116, y: 0, width: 100, height: 50 };
    const path = routeOrthogonalAvoiding(from, to, [], 12);
    const start = path[0]!;
    const end = path[path.length - 1]!;
    expect(Math.abs(start.x - (from.x + from.width))).toBeLessThan(1);
    expect(Math.abs(end.x - to.x)).toBeLessThan(1);
    const len = path.reduce((acc, p, i) => {
      if (i === 0) return 0;
      const prev = path[i - 1]!;
      return acc + Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
    }, 0);
    expect(len).toBeLessThan(40);
  });

  it("skims above a pack sibling instead of touring the local hull", () => {
    // Reserve → Inventory with Pay sitting in the east exit corridor (column hop).
    const from = { x: 424, y: 320, width: 128, height: 72 };
    const to = { x: 900, y: 207, width: 120, height: 62 };
    const sibling = { x: 580, y: 320, width: 128, height: 84 };
    const above = { x: 502, y: 120, width: 128, height: 72 };
    const path = routeOrthogonalAvoiding(from, to, [sibling, above], 12);
    const len = path.reduce((acc, p, i) => {
      if (i === 0) return 0;
      const prev = path[i - 1]!;
      return acc + Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
    }, 0);
    expect(len).toBeLessThan(550);
    // Must not run left of the source (classic hull-left perimeter escape).
    const minX = Math.min(...path.map((p) => p.x));
    expect(minX).toBeGreaterThanOrEqual(from.x - 1);
  });

  it("goes around a dense pack instead of cutting through siblings", () => {
    // Flowchart-catalog style: decision bottom-left → task top-right, with two
    // siblings filling the straight corridor (was: horizontal through both).
    const from = { x: 0, y: 120, width: 100, height: 80 };
    const to = { x: 280, y: 0, width: 80, height: 50 };
    const midA = { x: 0, y: 20, width: 90, height: 60 };
    const midB = { x: 120, y: 40, width: 100, height: 70 };
    const path = routeOrthogonalAvoiding(from, to, [midA, midB], 12);
    for (const box of [midA, midB]) {
      const inflated = {
        x: box.x - 12,
        y: box.y - 12,
        width: box.width + 24,
        height: box.height + 24,
      };
      for (let i = 0; i < path.length - 1; i++) {
        expect(segmentHitsRect(path[i]!, path[i + 1]!, inflated)).toBe(false);
      }
    }
  });

  it("prefers top entry over a bottom U-turn onto the east face", () => {
    // Choice above → compensate below-left, with a wide intervening band that
    // used to force a right-rail → under → east-face attach.
    const from = { x: 200, y: 0, width: 120, height: 80 };
    const to = { x: 40, y: 360, width: 160, height: 60 };
    const band = { x: 40, y: 120, width: 320, height: 200 };
    const path = routeOrthogonalAvoiding(from, to, [band], 12);
    const end = path[path.length - 1]!;
    expect(Math.abs(end.y - to.y)).toBeLessThan(1);
    expect(end.x).toBeGreaterThan(to.x - 1);
    expect(end.x).toBeLessThan(to.x + to.width + 1);
    // Must not attach on the east face.
    expect(Math.abs(end.x - (to.x + to.width))).toBeGreaterThan(1);
  });
});
