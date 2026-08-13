import type { Point, Rect } from "../types.ts";
import { DEFAULT_STROKE_WIDTH } from "../types.ts";
import {
  type ShapeGeometry,
  defaultLayoutFootprint,
  defaultPortNormal,
  defaultVisualBounds,
  projectSidePortOntoPolygon,
} from "../shape-geometry.ts";
import { intersectRayPolygon, pointInPolygon, polygonToPath } from "../math.ts";

/** Flat-top hexagon inset: height-led so wide short nodes keep real chamfers. */
export function hexagonInset(width: number, height: number): number {
  return Math.min(width * 0.22, height * 0.42, width * 0.5 - 4);
}

export function hexagonPolygon(bounds: Rect): Point[] {
  const { x, y, width, height } = bounds;
  const inset = hexagonInset(width, height);
  const midY = y + height / 2;
  return [
    { x: x + inset, y },
    { x: x + width - inset, y },
    { x: x + width, y: midY },
    { x: x + width - inset, y: y + height },
    { x: x + inset, y: y + height },
    { x, y: midY },
  ];
}

export function hexagonPointsString(bounds: Rect): string {
  return hexagonPolygon(bounds)
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
}

function createHexGeometry(id: string): ShapeGeometry {
  const geometry: ShapeGeometry = {
    id,
    defaultSize: { width: 160, height: 72 },
    minSize: { width: 72, height: 40 },
    defaultPadding: { top: 14, right: 20, bottom: 14, left: 20 },
    contentPolicy: {
      align: "center",
      maxLabelLines: 2,
      iconPlacement: "none",
    },

    getPath(bounds) {
      const polygon = hexagonPolygon(bounds);
      return { d: polygonToPath(polygon), polygon };
    },

    getContentBounds(bounds, style = {}) {
      const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
      const inset = hexagonInset(bounds.width, bounds.height);
      // Exclude angled ends — keep central rectangle.
      return {
        x: bounds.x + inset,
        y: bounds.y + stroke + 4,
        width: Math.max(0, bounds.width - inset * 2),
        height: Math.max(0, bounds.height - (stroke + 4) * 2),
      };
    },

    getVisualBounds(bounds, style) {
      return defaultVisualBounds(bounds, style);
    },

    getLayoutFootprint(bounds, context, style) {
      return defaultLayoutFootprint(geometry, bounds, context, style);
    },

    getPortPosition(port, bounds) {
      return projectSidePortOntoPolygon(port, bounds, hexagonPolygon(bounds), intersectRayPolygon);
    },

    getPortNormal(port, bounds) {
      return defaultPortNormal(port, bounds);
    },

    intersectRay(bounds, origin, direction) {
      return intersectRayPolygon(hexagonPolygon(bounds), origin, direction);
    },

    containsPoint(bounds, point) {
      return pointInPolygon(point, hexagonPolygon(bounds));
    },
  };
  return geometry;
}

export const hexagonGeometry = createHexGeometry("hexagon");
