/**
 * Shape-aware perimeter attachment — single source of truth for where edges meet nodes.
 * Layout/routing call this after ELK so visual ports and routed endpoints stay aligned.
 */

import type { Point, Rect, Vec2 } from "./types.ts";
import type { ShapeStyle } from "./types.ts";
import { normalizeShapeId, resolveShapeGeometry } from "./registry.ts";

export type PerimeterAttachInput = {
  shapeId: string | undefined;
  bounds: Rect;
  /** Ray origin (typically the adjacent bend / corridor point, outside the fill). */
  origin: Point;
  /** Direction toward this node (will be normalized). */
  direction: Vec2;
  style?: ShapeStyle;
};

/** Intersection of a ray with the shape perimeter; falls back via center ray, then center. */
export function attachPointOnPerimeter(input: PerimeterAttachInput): Point {
  const geometry = resolveShapeGeometry(normalizeShapeId(input.shapeId));
  const hit = geometry.intersectRay(input.bounds, input.origin, input.direction, input.style);
  if (hit) return hit;
  const cx = input.bounds.x + input.bounds.width / 2;
  const cy = input.bounds.y + input.bounds.height / 2;
  return (
    geometry.intersectRay(input.bounds, { x: cx, y: cy }, input.direction, input.style) ?? {
      x: cx,
      y: cy,
    }
  );
}
