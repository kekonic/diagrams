import type { Point, Rect } from "../types.ts";
import { DEFAULT_STROKE_WIDTH } from "../types.ts";
import {
  type ShapeGeometry,
  defaultLayoutFootprint,
  defaultPortNormal,
  defaultVisualBounds,
  projectSidePortOntoPolygon,
} from "../shape-geometry.ts";
import { intersectRayPolygon, pointInEllipse } from "../math.ts";

export function cylinderRadii(width: number, height: number): { rx: number; ry: number } {
  const rx = width / 2;
  // Cap ry so short nodes stay readable and tall DBs keep a crisp lid.
  const ry = Math.min(Math.max(width * 0.125, 7), height * 0.16, 13);
  return { rx, ry };
}

/**
 * Cylinder as one closed silhouette + front rim arc.
 * Prefer a single coordinated path set for intersection/hit testing.
 */
export function cylinderPaths(bounds: Rect): { body: string; rim: string } {
  const { x, y, width, height } = bounds;
  const { rx, ry } = cylinderRadii(width, height);
  const body = [
    `M ${x} ${y + ry}`,
    `a ${rx} ${ry} 0 0 1 ${width} 0`,
    `l 0 ${height - 2 * ry}`,
    `a ${rx} ${ry} 0 0 1 ${-width} 0`,
    `z`,
  ].join(" ");
  const rim = `M ${x} ${y + ry} a ${rx} ${ry} 0 0 0 ${width} 0`;
  return { body, rim };
}

/**
 * Sampled silhouette matching `cylinderPaths` body (top arc → right side → bottom arc → left).
 * Used for perimeter attachment so tall cylinders hit vertical walls, not a bounding ellipse.
 */
export function cylinderSilhouettePolygon(bounds: Rect, samplesPerCap = 16): Point[] {
  const { x, y, width, height } = bounds;
  const { rx, ry } = cylinderRadii(width, height);
  const cx = x + rx;
  const pts: Point[] = [];
  for (let i = 0; i <= samplesPerCap; i++) {
    const t = Math.PI - (i / samplesPerCap) * Math.PI; // π → 0 via top
    pts.push({ x: cx + rx * Math.cos(t), y: y + ry - ry * Math.sin(t) });
  }
  for (let i = 0; i <= samplesPerCap; i++) {
    const t = (i / samplesPerCap) * Math.PI; // 0 → π via bottom
    pts.push({
      x: cx + rx * Math.cos(t),
      y: y + height - ry + ry * Math.sin(t),
    });
  }
  return pts;
}

export const cylinderGeometry: ShapeGeometry = {
  id: "cylinder",
  defaultSize: { width: 140, height: 88 },
  minSize: { width: 64, height: 56 },
  defaultPadding: { top: 22, right: 16, bottom: 14, left: 16 },
  contentPolicy: {
    align: "center",
    maxLabelLines: 2,
    iconPlacement: "none",
  },

  getPath(bounds) {
    const { body, rim } = cylinderPaths(bounds);
    return {
      d: body,
      decorations: [{ d: rim, role: "rim" }],
    };
  },

  getContentBounds(bounds, style = {}) {
    const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    const { ry } = cylinderRadii(bounds.width, bounds.height);
    // Content begins below ~20–25% / top ellipse.
    const topReserve = Math.max(ry * 2, bounds.height * 0.22);
    return {
      x: bounds.x + stroke + 8,
      y: bounds.y + topReserve,
      width: Math.max(0, bounds.width - (stroke + 8) * 2),
      height: Math.max(0, bounds.height - topReserve - stroke - 8),
    };
  },

  getVisualBounds(bounds, style) {
    return defaultVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(cylinderGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds) {
    return projectSidePortOntoPolygon(
      port,
      bounds,
      cylinderSilhouettePolygon(bounds),
      intersectRayPolygon,
    );
  },

  getPortNormal(port, bounds) {
    return defaultPortNormal(port, bounds);
  },

  intersectRay(bounds, origin, direction) {
    return intersectRayPolygon(cylinderSilhouettePolygon(bounds), origin, direction);
  },

  containsPoint(bounds, point) {
    const { ry } = cylinderRadii(bounds.width, bounds.height);
    const top: Rect = { x: bounds.x, y: bounds.y, width: bounds.width, height: ry * 2 };
    const bottom: Rect = {
      x: bounds.x,
      y: bounds.y + bounds.height - ry * 2,
      width: bounds.width,
      height: ry * 2,
    };
    const body: Rect = {
      x: bounds.x,
      y: bounds.y + ry,
      width: bounds.width,
      height: Math.max(0, bounds.height - ry * 2),
    };
    if (
      point.x >= body.x &&
      point.x <= body.x + body.width &&
      point.y >= body.y &&
      point.y <= body.y + body.height
    ) {
      return true;
    }
    return pointInEllipse(point, top) || pointInEllipse(point, bottom);
  },
};
