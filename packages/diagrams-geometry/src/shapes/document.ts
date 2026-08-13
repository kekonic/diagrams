import type { Rect } from "../types.ts";
import { DEFAULT_STROKE_WIDTH } from "../types.ts";
import {
  type ShapeGeometry,
  defaultLayoutFootprint,
  defaultPortNormal,
  defaultVisualBounds,
  projectSidePortOntoPolygon,
} from "../shape-geometry.ts";
import { intersectRayPolygon, pointInPolygon, polygonToPath } from "../math.ts";

/**
 * Document: rectangle with a deterministic wavy bottom.
 * Ray tests and south ports use the same sampled wave polygon as the path.
 */
export function documentPolygon(bounds: Rect, samples = 8): Array<{ x: number; y: number }> {
  const { x, y, width, height } = bounds;
  const waveAmp = Math.min(10, height * 0.12);
  const bodyH = height - waveAmp;
  const pts: Array<{ x: number; y: number }> = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + bodyH },
  ];
  for (let i = samples; i >= 0; i--) {
    const t = i / samples;
    const px = x + width * t;
    // Single smooth sine dip — deterministic, easy to intersect.
    const py = y + bodyH + Math.sin(t * Math.PI) * waveAmp;
    pts.push({ x: px, y: py });
  }
  return pts;
}

export const documentGeometry: ShapeGeometry = {
  id: "document",
  defaultSize: { width: 140, height: 80 },
  minSize: { width: 64, height: 48 },
  defaultPadding: { top: 14, right: 16, bottom: 20, left: 16 },
  contentPolicy: { align: "start", maxLabelLines: 2, iconPlacement: "leading" },

  getPath(bounds) {
    const polygon = documentPolygon(bounds);
    return { d: polygonToPath(polygon), polygon };
  },

  getContentBounds(bounds, style = {}) {
    const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    const waveAmp = Math.min(10, bounds.height * 0.12);
    return {
      x: bounds.x + stroke + 8,
      y: bounds.y + stroke + 8,
      width: Math.max(0, bounds.width - (stroke + 8) * 2),
      height: Math.max(0, bounds.height - waveAmp - stroke * 2 - 16),
    };
  },

  getVisualBounds(bounds, style) {
    return defaultVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(documentGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds) {
    return projectSidePortOntoPolygon(port, bounds, documentPolygon(bounds), intersectRayPolygon);
  },

  getPortNormal(port, bounds) {
    return defaultPortNormal(port, bounds);
  },

  intersectRay(bounds, origin, direction) {
    return intersectRayPolygon(documentPolygon(bounds), origin, direction);
  },

  containsPoint(bounds, point) {
    return pointInPolygon(point, documentPolygon(bounds));
  },
};

/** Folded-corner note — rectangle with a clipped top-right fold. */
export function foldedCornerPath(bounds: Rect, fold = 14): { body: string; foldLine: string } {
  const { x, y, width, height } = bounds;
  const f = Math.min(fold, width * 0.25, height * 0.25);
  const body = [
    `M ${x} ${y}`,
    `L ${x + width - f} ${y}`,
    `L ${x + width} ${y + f}`,
    `L ${x + width} ${y + height}`,
    `L ${x} ${y + height}`,
    `Z`,
  ].join(" ");
  const foldLine = `M ${x + width - f} ${y} L ${x + width - f} ${y + f} L ${x + width} ${y + f}`;
  return { body, foldLine };
}

export function foldedDocumentPolygon(bounds: Rect, fold = 14): Array<{ x: number; y: number }> {
  const { x, y, width, height } = bounds;
  const f = Math.min(fold, width * 0.25, height * 0.25);
  return [
    { x, y },
    { x: x + width - f, y },
    { x: x + width, y: y + f },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

export const foldedDocumentGeometry: ShapeGeometry = {
  id: "folded-document",
  defaultSize: { width: 140, height: 80 },
  minSize: { width: 64, height: 48 },
  defaultPadding: { top: 14, right: 18, bottom: 14, left: 14 },
  contentPolicy: { align: "start", maxLabelLines: 3, iconPlacement: "none" },

  getPath(bounds) {
    const { body, foldLine } = foldedCornerPath(bounds);
    return { d: body, decorations: [{ d: foldLine, role: "fold" }] };
  },

  getContentBounds(bounds, style = {}) {
    const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    const fold = Math.min(14, bounds.width * 0.25);
    return {
      x: bounds.x + stroke + 8,
      y: bounds.y + stroke + 8,
      width: Math.max(0, bounds.width - fold - stroke * 2 - 12),
      height: Math.max(0, bounds.height - (stroke + 8) * 2),
    };
  },

  getVisualBounds(bounds, style) {
    return defaultVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(foldedDocumentGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds) {
    return projectSidePortOntoPolygon(
      port,
      bounds,
      foldedDocumentPolygon(bounds),
      intersectRayPolygon,
    );
  },

  getPortNormal(port, bounds) {
    return defaultPortNormal(port, bounds);
  },

  intersectRay(bounds, origin, direction) {
    return intersectRayPolygon(foldedDocumentPolygon(bounds), origin, direction);
  },

  containsPoint(bounds, point) {
    return pointInPolygon(point, foldedDocumentPolygon(bounds));
  },
};
