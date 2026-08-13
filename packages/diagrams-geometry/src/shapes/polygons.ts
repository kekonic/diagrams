import type { Point, Rect } from "../types.ts";
import { DEFAULT_STROKE_WIDTH } from "../types.ts";
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

export type SkewDirection = "left" | "right";

export function parallelogramPolygon(
  bounds: Rect,
  skewRatio = 0.18,
  direction: SkewDirection = "right",
): Point[] {
  const skew = Math.min(bounds.width * skewRatio, bounds.width * 0.35);
  const { x, y, width, height } = bounds;
  if (direction === "right") {
    return [
      { x: x + skew, y },
      { x: x + width, y },
      { x: x + width - skew, y: y + height },
      { x, y: y + height },
    ];
  }
  return [
    { x, y },
    { x: x + width - skew, y },
    { x: x + width, y: y + height },
    { x: x + skew, y: y + height },
  ];
}

export function createParallelogramGeometry(
  id = "parallelogram",
  direction: SkewDirection = "right",
): ShapeGeometry {
  const geometry: ShapeGeometry = {
    id,
    defaultSize: { width: 160, height: 64 },
    minSize: { width: 72, height: 36 },
    defaultPadding: { top: 12, right: 24, bottom: 12, left: 24 },
    contentPolicy: { align: "center", maxLabelLines: 2, iconPlacement: "none" },

    getPath(bounds) {
      const polygon = parallelogramPolygon(bounds, 0.18, direction);
      return { d: polygonToPath(polygon), polygon };
    },

    getContentBounds(bounds, style = {}) {
      const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
      const skew = Math.min(bounds.width * 0.18, bounds.width * 0.35);
      return {
        x: bounds.x + skew + stroke,
        y: bounds.y + stroke + 4,
        width: Math.max(0, bounds.width - skew * 2 - stroke * 2),
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
      return projectSidePortOntoPolygon(
        port,
        bounds,
        parallelogramPolygon(bounds, 0.18, direction),
        intersectRayPolygon,
      );
    },

    getPortNormal(port, bounds) {
      return defaultPortNormal(port, bounds);
    },

    intersectRay(bounds, origin, directionVec) {
      return intersectRayPolygon(
        parallelogramPolygon(bounds, 0.18, direction),
        origin,
        directionVec,
      );
    },

    containsPoint(bounds, point) {
      return pointInPolygon(point, parallelogramPolygon(bounds, 0.18, direction));
    },
  };
  return geometry;
}

export const parallelogramGeometry = createParallelogramGeometry();

export function trapezoidPolygon(bounds: Rect, narrowTop = true, insetRatio = 0.16): Point[] {
  const inset = Math.min(bounds.width * insetRatio, bounds.width * 0.3);
  const { x, y, width, height } = bounds;
  if (narrowTop) {
    return [
      { x: x + inset, y },
      { x: x + width - inset, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width - inset, y: y + height },
    { x: x + inset, y: y + height },
  ];
}

export function createTrapezoidGeometry(id = "trapezoid", narrowTop = false): ShapeGeometry {
  const geometry: ShapeGeometry = {
    id,
    defaultSize: { width: 160, height: 64 },
    minSize: { width: 72, height: 36 },
    defaultPadding: { top: 12, right: 16, bottom: 12, left: 16 },
    contentPolicy: { align: "center", maxLabelLines: 2, iconPlacement: "none" },

    getPath(bounds) {
      const polygon = trapezoidPolygon(bounds, narrowTop);
      return { d: polygonToPath(polygon), polygon };
    },

    getContentBounds(bounds, style = {}) {
      const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
      const inset = Math.min(bounds.width * 0.16, bounds.width * 0.3);
      return {
        x: bounds.x + inset + stroke,
        y: bounds.y + stroke + 4,
        width: Math.max(0, bounds.width - inset * 2 - stroke * 2),
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
      return projectSidePortOntoPolygon(
        port,
        bounds,
        trapezoidPolygon(bounds, narrowTop),
        intersectRayPolygon,
      );
    },

    getPortNormal(port, bounds) {
      return defaultPortNormal(port, bounds);
    },

    intersectRay(bounds, origin, direction) {
      return intersectRayPolygon(trapezoidPolygon(bounds, narrowTop), origin, direction);
    },

    containsPoint(bounds, point) {
      return pointInPolygon(point, trapezoidPolygon(bounds, narrowTop));
    },
  };
  return geometry;
}

/** Manual operation: wider top. */
export const trapezoidGeometry = createTrapezoidGeometry("trapezoid", false);

export function trianglePolygon(bounds: Rect): Point[] {
  const cx = bounds.x + bounds.width / 2;
  return [
    { x: cx, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

export const triangleGeometry: ShapeGeometry = {
  id: "triangle",
  defaultSize: { width: 72, height: 64 },
  minSize: { width: 32, height: 28 },
  defaultPadding: { top: 16, right: 12, bottom: 8, left: 12 },
  contentPolicy: {
    align: "center",
    maxLabelLines: 1,
    preferExternalLabel: true,
    iconPlacement: "centered",
  },
  clearSpaceBoost: 8,

  getPath(bounds) {
    const polygon = trianglePolygon(bounds);
    return { d: polygonToPath(polygon), polygon };
  },

  getContentBounds(bounds, style = {}) {
    const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    return centeredContentRect(
      {
        x: bounds.x + stroke,
        y: bounds.y + bounds.height * 0.35,
        width: Math.max(0, bounds.width - stroke * 2),
        height: Math.max(0, bounds.height * 0.45 - stroke),
      },
      1,
      1,
    );
  },

  getVisualBounds(bounds, style) {
    return defaultVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(triangleGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds) {
    return projectSidePortOntoPolygon(port, bounds, trianglePolygon(bounds), intersectRayPolygon);
  },

  getPortNormal(port, bounds) {
    return defaultPortNormal(port, bounds);
  },

  intersectRay(bounds, origin, direction) {
    return intersectRayPolygon(trianglePolygon(bounds), origin, direction);
  },

  containsPoint(bounds, point) {
    return pointInPolygon(point, trianglePolygon(bounds));
  },
};
