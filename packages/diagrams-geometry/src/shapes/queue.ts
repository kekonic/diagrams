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

/**
 * Horizontal pipe (sideways cylinder) — the ubiquitous message-queue silhouette.
 * End-cap radius is height-led so short wide queues keep readable openings.
 */
export function queueRadii(width: number, height: number): { rx: number; ry: number } {
  const ry = height / 2;
  const rx = Math.min(Math.max(height * 0.125, 7), width * 0.16, 13);
  return { rx, ry };
}

/**
 * Pipe body + left-end rim (front opening), matching vertical cylinder conventions.
 */
export function queuePaths(bounds: Rect): { body: string; rim: string } {
  const { x, y, width, height } = bounds;
  const { rx, ry } = queueRadii(width, height);
  const body = [
    `M ${x + rx} ${y}`,
    `l ${width - 2 * rx} 0`,
    `a ${rx} ${ry} 0 0 1 0 ${height}`,
    `l ${-(width - 2 * rx)} 0`,
    `a ${rx} ${ry} 0 0 1 0 ${-height}`,
    `z`,
  ].join(" ");
  // Front rim on the left opening (looks into the pipe).
  const rim = `M ${x + rx} ${y} a ${rx} ${ry} 0 0 0 0 ${height}`;
  return { body, rim };
}

/**
 * Sampled silhouette for ports / ray hits (left ellipse → top → right ellipse → bottom).
 */
export function queueSilhouettePolygon(bounds: Rect, samplesPerCap = 16): Point[] {
  const { x, y, width, height } = bounds;
  const { rx, ry } = queueRadii(width, height);
  const cy = y + ry;
  const pts: Point[] = [];
  // Left cap: bottom → top via the outer (west) arc.
  for (let i = 0; i <= samplesPerCap; i++) {
    const t = Math.PI / 2 + (i / samplesPerCap) * Math.PI; // π/2 → 3π/2
    pts.push({ x: x + rx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  // Right cap: top → bottom via the outer (east) arc.
  for (let i = 0; i <= samplesPerCap; i++) {
    const t = -Math.PI / 2 + (i / samplesPerCap) * Math.PI; // -π/2 → π/2
    pts.push({ x: x + width - rx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return pts;
}

export const queueGeometry: ShapeGeometry = {
  id: "queue",
  defaultSize: { width: 160, height: 64 },
  minSize: { width: 72, height: 40 },
  defaultPadding: { top: 12, right: 22, bottom: 12, left: 22 },
  contentPolicy: {
    align: "center",
    maxLabelLines: 2,
    iconPlacement: "leading",
  },

  getPath(bounds) {
    const { body, rim } = queuePaths(bounds);
    return {
      d: body,
      decorations: [{ d: rim, role: "rim" }],
    };
  },

  getContentBounds(bounds, style = {}) {
    const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    const { rx } = queueRadii(bounds.width, bounds.height);
    // Keep content clear of the elliptical end caps.
    const sideReserve = Math.max(rx * 2, bounds.width * 0.12);
    return {
      x: bounds.x + sideReserve,
      y: bounds.y + stroke + 6,
      width: Math.max(0, bounds.width - sideReserve * 2),
      height: Math.max(0, bounds.height - (stroke + 6) * 2),
    };
  },

  getVisualBounds(bounds, style) {
    return defaultVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(queueGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds) {
    return projectSidePortOntoPolygon(
      port,
      bounds,
      queueSilhouettePolygon(bounds),
      intersectRayPolygon,
    );
  },

  getPortNormal(port, bounds) {
    return defaultPortNormal(port, bounds);
  },

  intersectRay(bounds, origin, direction) {
    return intersectRayPolygon(queueSilhouettePolygon(bounds), origin, direction);
  },

  containsPoint(bounds, point) {
    const { rx } = queueRadii(bounds.width, bounds.height);
    const left: Rect = {
      x: bounds.x,
      y: bounds.y,
      width: rx * 2,
      height: bounds.height,
    };
    const right: Rect = {
      x: bounds.x + bounds.width - rx * 2,
      y: bounds.y,
      width: rx * 2,
      height: bounds.height,
    };
    const body: Rect = {
      x: bounds.x + rx,
      y: bounds.y,
      width: Math.max(0, bounds.width - rx * 2),
      height: bounds.height,
    };
    if (
      point.x >= body.x &&
      point.x <= body.x + body.width &&
      point.y >= body.y &&
      point.y <= body.y + body.height
    ) {
      return true;
    }
    return pointInEllipse(point, left) || pointInEllipse(point, right);
  },
};
