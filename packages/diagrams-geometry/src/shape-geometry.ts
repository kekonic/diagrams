import type { Point, Rect, Vec2 } from "@kekonic/diagrams-core";
import type {
  ContentPolicy,
  Insets,
  LayoutContext,
  NodeBoundsModel,
  PathData,
  PortRef,
  PortSide,
  ShapeStyle,
  Size,
} from "./types.ts";
import {
  CLEAR_SPACE_PRESETS,
  DEFAULT_STROKE_WIDTH,
  EDGE_LAUNCH_PRESETS,
  MIN_INTERACTION_TARGET,
  expandRectInsets,
  insets,
  sideMidpoint,
  sideNormal,
  unionRects,
  uniformInsets,
} from "./types.ts";
import { strokeOutset } from "./math.ts";

/**
 * Renderer-neutral shape geometry contract.
 *
 * Every foundational shape implements this so measure, layout, routing, and
 * renderers share one source of truth for paths, content, ports, and hits.
 */
export interface ShapeGeometry {
  readonly id: string;

  /** SVG path / polygon for the primary outline. */
  getPath(bounds: Rect, style?: ShapeStyle): PathData;

  /** Safe interior rectangle for text/icons/compartments. */
  getContentBounds(bounds: Rect, style?: ShapeStyle): Rect;

  /** Visible extent including stroke (and optional shadow). */
  getVisualBounds(bounds: Rect, style?: ShapeStyle): Rect;

  /** Layout reservation including clear space and edge-launch corridor. */
  getLayoutFootprint(bounds: Rect, context?: LayoutContext, style?: ShapeStyle): Rect;

  /** World position of a port on/around the shape. */
  getPortPosition(port: PortRef, bounds: Rect, style?: ShapeStyle): Point;

  /** Outward unit normal at a port (edge launch direction). */
  getPortNormal(port: PortRef, bounds: Rect, style?: ShapeStyle): Vec2;

  /** Intersection of a ray with the visible perimeter. */
  intersectRay(bounds: Rect, origin: Point, direction: Vec2, style?: ShapeStyle): Point | null;

  /** Point-in-shape test for hit testing (geometry fill, not interaction pad). */
  containsPoint(bounds: Rect, point: Point, style?: ShapeStyle): boolean;

  /** Optional preferred default / min sizes. */
  defaultSize?: Size;
  minSize?: Size;
  defaultPadding?: Insets;
  contentPolicy?: ContentPolicy;
  /** Extra clear-space units beyond density preset (pointed corners, etc.). */
  clearSpaceBoost?: number;
}

export type ShapeGeometryBaseOptions = {
  id: string;
  defaultSize?: Size;
  minSize?: Size;
  defaultPadding?: Insets;
  contentPolicy?: ContentPolicy;
  /** Extra clear space beyond density preset (e.g. pointed corners). */
  clearSpaceBoost?: number;
};

/** Assemble the full node bounds model from a geometry + style + context. */
export function buildNodeBoundsModel(
  geometry: ShapeGeometry,
  bounds: Rect,
  style: ShapeStyle = {},
  context: LayoutContext = {},
): NodeBoundsModel {
  const content = geometry.getContentBounds(bounds, style);
  const visual = geometry.getVisualBounds(bounds, style);
  const extras: Rect[] = [visual];
  if (context.externalLabels) extras.push(...context.externalLabels);
  if (context.badges) extras.push(...context.badges);
  const visualWithChrome = unionRects(extras);

  const density = context.density ?? "standard";
  const baseClear = CLEAR_SPACE_PRESETS[density];
  const boost = geometry.clearSpaceBoost ?? 0;
  const clearSpace = insets(context.clearSpace ?? {}, baseClear + boost);
  const launch = context.edgeLaunch ?? EDGE_LAUNCH_PRESETS[density];
  const footprintPad: Insets = {
    top: clearSpace.top + launch,
    right: clearSpace.right + launch,
    bottom: clearSpace.bottom + launch,
    left: clearSpace.left + launch,
  };
  const footprint = expandRectInsets(visualWithChrome, footprintPad);

  const interactionPad = Math.max(
    0,
    (MIN_INTERACTION_TARGET - Math.min(bounds.width, bounds.height)) / 2,
  );
  const interaction =
    interactionPad > 0 ? expandRectInsets(visualWithChrome, interactionPad) : visualWithChrome;

  return {
    geometry: { ...bounds },
    content,
    visual: visualWithChrome,
    interaction,
    footprint,
    clearSpace,
  };
}

/** Shared helpers for concrete geometries. */
export function defaultVisualBounds(bounds: Rect, style: ShapeStyle = {}): Rect {
  const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const outset = strokeOutset(stroke);
  let visual = expandRectInsets(bounds, outset);
  if (style.shadowBlur || style.shadowOffsetX || style.shadowOffsetY) {
    const blur = style.shadowBlur ?? 0;
    const ox = style.shadowOffsetX ?? 0;
    const oy = style.shadowOffsetY ?? 0;
    visual = unionRects([
      visual,
      {
        x: bounds.x + Math.min(0, ox) - blur,
        y: bounds.y + Math.min(0, oy) - blur,
        width: bounds.width + Math.abs(ox) + blur * 2,
        height: bounds.height + Math.abs(oy) + blur * 2,
      },
    ]);
  }
  return visual;
}

export function defaultLayoutFootprint(
  geometry: ShapeGeometry,
  bounds: Rect,
  context: LayoutContext = {},
  style: ShapeStyle = {},
): Rect {
  return buildNodeBoundsModel(geometry, bounds, style, context).footprint;
}

export function defaultSidePortPosition(port: PortRef, bounds: Rect): Point {
  if (port.kind === "center") {
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }
  if (port.kind === "corner") {
    switch (port.corner) {
      case "northwest":
        return { x: bounds.x, y: bounds.y };
      case "northeast":
        return { x: bounds.x + bounds.width, y: bounds.y };
      case "southeast":
        return { x: bounds.x + bounds.width, y: bounds.y + bounds.height };
      case "southwest":
        return { x: bounds.x, y: bounds.y + bounds.height };
    }
  }
  if (port.kind === "radial") {
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const rad = (port.angleDeg * Math.PI) / 180;
    // Approximate on bbox ellipse.
    return {
      x: cx + Math.cos(rad) * (bounds.width / 2),
      y: cy + Math.sin(rad) * (bounds.height / 2),
    };
  }
  if (port.kind === "named") {
    return sideMidpoint(bounds, "east");
  }
  // side
  const side = port.side;
  const count = Math.max(1, port.count ?? 1);
  const index = Math.min(Math.max(0, port.index ?? 0), count - 1);
  if (count === 1) return sideMidpoint(bounds, side);
  return distributedSidePort(bounds, side, index, count);
}

/**
 * Place a side port on a non-rect silhouette.
 * Starts from the AABB mid/distributed point, then casts from the shape center
 * onto the outline so FIXED_POS pins and perimeter snap share one attach truth.
 */
export function projectSidePortOntoOutline(
  port: PortRef,
  bounds: Rect,
  hitFromCenter: (direction: Vec2) => Point | null,
): Point {
  const bboxPt = defaultSidePortPosition(port, bounds);
  if (port.kind !== "side") return bboxPt;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const direction = { x: bboxPt.x - cx, y: bboxPt.y - cy };
  if (Math.hypot(direction.x, direction.y) < 1e-9) return bboxPt;
  return hitFromCenter(direction) ?? bboxPt;
}

/** Convenience: project onto a polygon silhouette via center→AABB ray. */
export function projectSidePortOntoPolygon(
  port: PortRef,
  bounds: Rect,
  polygon: Point[],
  intersect: (polygon: Point[], origin: Point, direction: Vec2) => Point | null,
): Point {
  return projectSidePortOntoOutline(port, bounds, (direction) =>
    intersect(
      polygon,
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      direction,
    ),
  );
}

export function distributedSidePort(
  bounds: Rect,
  side: PortSide,
  index: number,
  count: number,
  sideInset = 8,
): Point {
  const usable =
    side === "north" || side === "south"
      ? Math.max(0, bounds.width - sideInset * 2)
      : Math.max(0, bounds.height - sideInset * 2);
  const step = count > 1 ? usable / (count - 1) : 0;
  const offset = sideInset + step * index;
  switch (side) {
    case "north":
      return { x: bounds.x + offset, y: bounds.y };
    case "south":
      return { x: bounds.x + offset, y: bounds.y + bounds.height };
    case "east":
      return { x: bounds.x + bounds.width, y: bounds.y + offset };
    case "west":
      return { x: bounds.x, y: bounds.y + offset };
  }
}

export function defaultPortNormal(port: PortRef, _bounds: Rect): Vec2 {
  if (port.kind === "side") return sideNormal(port.side);
  if (port.kind === "corner") {
    switch (port.corner) {
      case "northwest":
        return normalizeVec({ x: -1, y: -1 });
      case "northeast":
        return normalizeVec({ x: 1, y: -1 });
      case "southeast":
        return normalizeVec({ x: 1, y: 1 });
      case "southwest":
        return normalizeVec({ x: -1, y: 1 });
    }
  }
  if (port.kind === "radial") {
    const rad = (port.angleDeg * Math.PI) / 180;
    return { x: Math.cos(rad), y: Math.sin(rad) };
  }
  if (port.kind === "center") {
    return { x: 1, y: 0 };
  }
  return { x: 1, y: 0 };
}

function normalizeVec(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

export { uniformInsets };
