import { describe, expect, it } from "vite-plus/test";
import { cylinderPaths } from "@kekonic/diagrams-geometry";
import { circlePath, roundedRectPath, sketchOpenPath, sketchShapePath } from "./sketch-stroke.ts";

function numbers(d: string): number[] {
  return [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function pointsOf(d: string): Array<{ x: number; y: number }> {
  const values = numbers(d);
  const points = [];
  for (let i = 0; i < values.length; i += 2) {
    points.push({ x: values[i]!, y: values[i + 1]! });
  }
  return points;
}

describe("sketchShapePath", () => {
  it("leaves a short outline on its original commands", () => {
    const d = roundedRectPath({ x: 0, y: 0, width: 10, height: 8 }, 0);
    expect(sketchShapePath(d, "node:tiny")).toBe(d);
  });

  it("wobbles a closed rectangle without leaving the border", () => {
    const d = roundedRectPath({ x: 10, y: 20, width: 120, height: 64 }, 0);
    const sketched = sketchShapePath(d, "node:orders");
    expect(sketched).not.toBe(d);
    expect(sketched.endsWith(" Z")).toBe(true);
    expect(sketchShapePath(d, "node:orders")).toBe(sketched);

    const points = pointsOf(sketched);
    expect(points.length).toBeGreaterThan(8);
    let peak = 0;
    for (const point of points) {
      const inside = point.x >= 10 && point.x <= 130 && point.y >= 20 && point.y <= 84;
      const dx = Math.min(Math.abs(point.x - 10), Math.abs(point.x - 130));
      const dy = Math.min(Math.abs(point.y - 20), Math.abs(point.y - 84));
      const gap = inside
        ? Math.min(dx, dy)
        : Math.hypot(
            point.x < 10 ? 10 - point.x : point.x > 130 ? point.x - 130 : 0,
            point.y < 20 ? 20 - point.y : point.y > 84 ? point.y - 84 : 0,
          );
      expect(gap).toBeLessThanOrEqual(1.26);
      peak = Math.max(peak, gap);
    }
    expect(peak).toBeGreaterThan(0.4);
    const closing = Math.hypot(
      points[0]!.x - points[points.length - 1]!.x,
      points[0]!.y - points[points.length - 1]!.y,
    );
    expect(closing).toBeLessThan(8);
  });

  it("keeps a circle on its radius", () => {
    const d = circlePath(50, 40, 30);
    const sketched = sketchShapePath(d, "node:state");
    expect(sketched).not.toContain("A ");
    expect(sketched.endsWith(" Z")).toBe(true);
    for (const point of pointsOf(sketched)) {
      const radius = Math.hypot(point.x - 50, point.y - 40);
      expect(radius).toBeGreaterThan(28.5);
      expect(radius).toBeLessThan(31.5);
    }
  });

  it("follows a cylinder lid instead of turning the arc inside out", () => {
    const { body, rim } = cylinderPaths({ x: 0, y: 0, width: 100, height: 80 });
    const sketched = sketchShapePath(body, "node:db");
    const rimmed = sketchShapePath(rim, "node:db:rim");
    expect(sketched.endsWith(" Z")).toBe(true);
    expect(rimmed.startsWith("M ")).toBe(true);
    expect(rimmed.endsWith(" Z")).toBe(false);
    const bodyPoints = pointsOf(sketched);
    expect(Math.min(...bodyPoints.map((point) => point.y))).toBeLessThan(5);
    expect(Math.max(...bodyPoints.map((point) => point.y))).toBeGreaterThan(75);
    for (const point of bodyPoints) {
      expect(point.x).toBeGreaterThan(-2);
      expect(point.x).toBeLessThan(102);
      expect(point.y).toBeGreaterThan(-2);
      expect(point.y).toBeLessThan(82);
    }
    const rimPoints = pointsOf(rimmed);
    expect(rimPoints[0]!.x).toBeCloseTo(0, 1);
    expect(rimPoints[rimPoints.length - 1]!.x).toBeCloseTo(100, 1);
  });

  it("still pins open stroke endpoints", () => {
    const d = "M 0 0 L 180 0";
    const sketched = sketchOpenPath(d, "edge:a:run:0");
    const values = numbers(sketched);
    expect(values[0]).toBe(0);
    expect(values[1]).toBe(0);
    expect(values.at(-2)).toBe(180);
    expect(values.at(-1)).toBe(0);
    expect(sketched).not.toBe(d);
  });
});
