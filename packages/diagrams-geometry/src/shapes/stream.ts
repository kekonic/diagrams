import type { Rect } from "../types.ts";
import { DEFAULT_STROKE_WIDTH } from "../types.ts";
import {
  type ShapeGeometry,
  defaultLayoutFootprint,
  defaultPortNormal,
  defaultVisualBounds,
  projectSidePortOntoPolygon,
} from "../shape-geometry.ts";
import { intersectRayPolygon, pointInPolygon } from "../math.ts";

/** Corner radius for the stacked-log shell. */
export function streamCornerRadius(height: number, width: number): number {
  return Math.min(10, height * 0.18, width * 0.12);
}

/**
 * Partition y positions (absolute) for the stacked-log / Kafka-style silhouette.
 * Two interior rules divide the card into three record bands.
 */
export function streamPartitionYs(bounds: Rect): [number, number] {
  const { y, height } = bounds;
  return [y + height / 3, y + (2 * height) / 3];
}

export function streamShellPath(bounds: Rect): string {
  const { x, y, width, height } = bounds;
  const r = streamCornerRadius(height, width);
  // Rounded rectangle as a closed path (works without relying on SVG rx).
  return [
    `M ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
    `L ${x + width} ${y + height - r}`,
    `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
    `L ${x + r} ${y + height}`,
    `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
    `L ${x} ${y + r}`,
    `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
    `Z`,
  ].join(" ");
}

/**
 * Short left-rail ticks — suggest stacked partitions without slicing through label/icon.
 */
export function streamPartitionPaths(bounds: Rect): string[] {
  const { x, width, height } = bounds;
  const tickLen = Math.min(14, Math.max(8, width * 0.1));
  const insetX = Math.max(8, streamCornerRadius(height, width) * 0.75);
  return streamPartitionYs(bounds).map(
    (py) => `M ${x + insetX} ${py} L ${x + insetX + tickLen} ${py}`,
  );
}

export function streamPolygon(bounds: Rect): Array<{ x: number; y: number }> {
  const { x, y, width, height } = bounds;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

/**
 * Stacked-log card — ubiquitous for streams, topics, and append-only partitions.
 * Outer shell holds the label; interior rules suggest record bands.
 */
export const streamGeometry: ShapeGeometry = {
  id: "stream",
  defaultSize: { width: 160, height: 72 },
  minSize: { width: 72, height: 48 },
  defaultPadding: { top: 14, right: 16, bottom: 14, left: 16 },
  contentPolicy: {
    align: "center",
    maxLabelLines: 2,
    iconPlacement: "leading",
  },

  getPath(bounds) {
    return {
      d: streamShellPath(bounds),
      decorations: streamPartitionPaths(bounds).map((d) => ({ d, role: "partition" })),
      polygon: streamPolygon(bounds),
    };
  },

  getContentBounds(bounds, style = {}) {
    const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    // Keep content clear of the left partition rail.
    const rail = Math.min(22, Math.max(16, bounds.width * 0.12));
    return {
      x: bounds.x + rail,
      y: bounds.y + stroke + 8,
      width: Math.max(0, bounds.width - rail - stroke - 10),
      height: Math.max(0, bounds.height - (stroke + 8) * 2),
    };
  },

  getVisualBounds(bounds, style) {
    return defaultVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(streamGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds) {
    return projectSidePortOntoPolygon(port, bounds, streamPolygon(bounds), intersectRayPolygon);
  },

  getPortNormal(port, bounds) {
    return defaultPortNormal(port, bounds);
  },

  intersectRay(bounds, origin, direction) {
    return intersectRayPolygon(streamPolygon(bounds), origin, direction);
  },

  containsPoint(bounds, point) {
    return pointInPolygon(point, streamPolygon(bounds));
  },
};
