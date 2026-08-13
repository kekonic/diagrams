/**
 * Universal node / shape geometry types.
 *
 * Geometry is independent of semantic node kinds. Renderers and layout consume
 * these regions; semantics (service, database, …) map onto shapes via registry.
 */

import type { Point, Rect, Vec2 } from "@kekonic/diagrams-core";

export type { Point, Rect, Vec2 };

/** Per-side insets in logical diagram units. */
export type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type Size = { width: number; height: number };

/** Cardinal / compass port sides. */
export type PortSide = "north" | "east" | "south" | "west";

/** Optional corner ports. */
export type PortCorner = "northwest" | "northeast" | "southeast" | "southwest";

export type PortRef =
  | { kind: "side"; side: PortSide; index?: number; count?: number }
  | { kind: "corner"; corner: PortCorner }
  | { kind: "center" }
  | { kind: "radial"; angleDeg: number }
  | { kind: "named"; name: string };

export type PortStrategy =
  | "bbox-mid"
  | "perimeter"
  | "distributed-sides"
  | "vertices"
  | "radial"
  | "semantic";

/** Stroke / fill hints that affect bounds and content insets. */
export type ShapeStyle = {
  strokeWidth?: number;
  cornerRadius?: number;
  /** Shadow blur radius (visual bounds only). */
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
};

export type LayoutDensity = "compact" | "standard" | "presentation";

export type LayoutContext = {
  density?: LayoutDensity;
  /** Extra clear space beyond geometry defaults. */
  clearSpace?: Partial<Insets>;
  /** Edge-launch corridor beyond the perimeter (layout footprint). */
  edgeLaunch?: number;
  /** External label boxes already measured (world coords relative to node origin). */
  externalLabels?: Rect[];
  /** Badges / markers relative to node origin. */
  badges?: Rect[];
};

/**
 * Full anatomy of a placed node in logical units.
 * Coordinates are relative to the geometry bounds origin unless noted.
 */
export type NodeBoundsModel = {
  /** Visible outline of the primary shape (no shadows/labels/ports). */
  geometry: Rect;
  /** Interior region for text, icons, compartments. */
  content: Rect;
  /** Complete visible extent including stroke, shadow, labels, badges, ports. */
  visual: Rect;
  /** Pointer hit region (at least visual; may expand for small targets). */
  interaction: Rect;
  /** Area reserved by layout (visual + clear space + launch corridors). */
  footprint: Rect;
  /** Non-rendered exclusion zone around the node. */
  clearSpace: Insets;
};

/** Path data returned by geometries — SVG `d` plus optional polygons. */
export type PathData = {
  /** Primary closed outline as SVG path `d`. */
  d: string;
  /** Optional secondary strokes (cylinder rim, subprocess markers, …). */
  decorations?: Array<{ d: string; role: string }>;
  /** Polygon vertices when the shape is polygonal (for intersection). */
  polygon?: Point[];
};

export type ContentPolicy = {
  /** Preferred content alignment. */
  align?: "center" | "start" | "end";
  /** Max preferred label lines before expand/truncate. */
  maxLabelLines?: number;
  /** Whether long labels should prefer external placement. */
  preferExternalLabel?: boolean;
  /** Icon placement when present. */
  iconPlacement?: "leading" | "above" | "centered" | "none";
};

export type ClearSpacePreset = LayoutDensity;

export const CLEAR_SPACE_PRESETS: Record<ClearSpacePreset, number> = {
  compact: 10,
  standard: 20,
  presentation: 32,
};

export const EDGE_LAUNCH_PRESETS: Record<ClearSpacePreset, number> = {
  compact: 10,
  standard: 16,
  presentation: 24,
};

/** Minimum interactive target in logical units (ports / markers). */
export const MIN_INTERACTION_TARGET = 22;

export const DEFAULT_STROKE_WIDTH = 1.6;

export function uniformInsets(n: number): Insets {
  return { top: n, right: n, bottom: n, left: n };
}

export function insets(partial: Partial<Insets>, fallback = 0): Insets {
  return {
    top: partial.top ?? fallback,
    right: partial.right ?? fallback,
    bottom: partial.bottom ?? fallback,
    left: partial.left ?? fallback,
  };
}

export function insetRect(r: Rect, pad: Insets | number): Rect {
  const p = typeof pad === "number" ? uniformInsets(pad) : pad;
  return {
    x: r.x + p.left,
    y: r.y + p.top,
    width: Math.max(0, r.width - p.left - p.right),
    height: Math.max(0, r.height - p.top - p.bottom),
  };
}

export function expandRectInsets(r: Rect, pad: Insets | number): Rect {
  const p = typeof pad === "number" ? uniformInsets(pad) : pad;
  return {
    x: r.x - p.left,
    y: r.y - p.top,
    width: r.width + p.left + p.right,
    height: r.height + p.top + p.bottom,
  };
}

export function unionRects(rects: Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rectFromSize(size: Size, origin: Point = { x: 0, y: 0 }): Rect {
  return { x: origin.x, y: origin.y, width: size.width, height: size.height };
}

export function normalizeVector(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

export function sideNormal(side: PortSide): Vec2 {
  switch (side) {
    case "north":
      return { x: 0, y: -1 };
    case "east":
      return { x: 1, y: 0 };
    case "south":
      return { x: 0, y: 1 };
    case "west":
      return { x: -1, y: 0 };
  }
}

export function sideMidpoint(bounds: Rect, side: PortSide): Point {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  switch (side) {
    case "north":
      return { x: cx, y: bounds.y };
    case "east":
      return { x: bounds.x + bounds.width, y: cy };
    case "south":
      return { x: cx, y: bounds.y + bounds.height };
    case "west":
      return { x: bounds.x, y: cy };
  }
}
