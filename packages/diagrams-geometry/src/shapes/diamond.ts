import type { Point, Rect } from "../types.ts";
import { DEFAULT_STROKE_WIDTH, insetRect } from "../types.ts";
import {
  type ShapeGeometry,
  defaultLayoutFootprint,
  defaultPortNormal,
  defaultVisualBounds,
  projectSidePortOntoPolygon,
} from "../shape-geometry.ts";
import {
  centeredContentRect,
  intersectRayPolygon,
  pointInPolygon,
  polygonToPath,
} from "../math.ts";

/** Diamond tips sit on bbox mid-sides so LR/TD ports land on vertices. */
export function diamondPolygon(bounds: Rect): Point[] {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  return [
    { x: cx, y: bounds.y },
    { x: bounds.x + bounds.width, y: cy },
    { x: cx, y: bounds.y + bounds.height },
    { x: bounds.x, y: cy },
  ];
}

export function diamondPointsString(bounds: Rect): string {
  return diamondPolygon(bounds)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
}

export const diamondGeometry: ShapeGeometry = {
  id: "diamond",
  defaultSize: { width: 140, height: 100 },
  minSize: { width: 64, height: 64 },
  defaultPadding: { top: 12, right: 12, bottom: 12, left: 12 },
  contentPolicy: {
    align: "center",
    maxLabelLines: 2,
    preferExternalLabel: false,
    iconPlacement: "none",
  },
  clearSpaceBoost: 6,

  getPath(bounds) {
    const polygon = diamondPolygon(bounds);
    return { d: polygonToPath(polygon), polygon };
  },

  getContentBounds(bounds, style = {}) {
    const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    // Spec: ~50% safe rectangle inside diamond.
    const content = centeredContentRect(bounds, 0.5, 0.5);
    return insetRect(content, stroke);
  },

  getVisualBounds(bounds, style) {
    return defaultVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(diamondGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds) {
    return projectSidePortOntoPolygon(port, bounds, diamondPolygon(bounds), intersectRayPolygon);
  },

  getPortNormal(port, bounds) {
    return defaultPortNormal(port, bounds);
  },

  intersectRay(bounds, origin, direction) {
    return intersectRayPolygon(diamondPolygon(bounds), origin, direction);
  },

  containsPoint(bounds, point) {
    return pointInPolygon(point, diamondPolygon(bounds));
  },
};
