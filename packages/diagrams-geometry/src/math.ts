import type { Point, Rect, Vec2 } from "./types.ts";
import { normalizeVector } from "./types.ts";

/** Ray from origin along direction; returns closest intersection with t >= 0. */
export function intersectRayPolygon(
  polygon: Point[],
  origin: Point,
  direction: Vec2,
): Point | null {
  if (polygon.length < 3) return null;
  const dir = normalizeVector(direction);
  let bestT = Infinity;
  let best: Point | null = null;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const hit = raySegmentIntersection(origin, dir, a, b);
    if (hit && hit.t >= 0 && hit.t < bestT) {
      bestT = hit.t;
      best = hit.point;
    }
  }
  return best;
}

function raySegmentIntersection(
  origin: Point,
  dir: Vec2,
  a: Point,
  b: Point,
): { t: number; point: Point } | null {
  const sx = b.x - a.x;
  const sy = b.y - a.y;
  const denom = dir.x * sy - dir.y * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const qx = a.x - origin.x;
  const qy = a.y - origin.y;
  const t = (qx * sy - qy * sx) / denom;
  const u = (qx * dir.y - qy * dir.x) / denom;
  if (u < -1e-9 || u > 1 + 1e-9) return null;
  return { t, point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t } };
}

/** Ellipse / circle ray intersection (axis-aligned). */
export function intersectRayEllipse(bounds: Rect, origin: Point, direction: Vec2): Point | null {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  if (rx <= 0 || ry <= 0) return null;
  const dir = normalizeVector(direction);
  // Transform to unit circle space.
  const ox = (origin.x - cx) / rx;
  const oy = (origin.y - cy) / ry;
  const dx = dir.x / rx;
  const dy = dir.y / ry;
  const a = dx * dx + dy * dy;
  const b = 2 * (ox * dx + oy * dy);
  const c = ox * ox + oy * oy - 1;
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a === 0) return null;
  const sqrt = Math.sqrt(disc);
  const t1 = (-b - sqrt) / (2 * a);
  const t2 = (-b + sqrt) / (2 * a);
  const candidates = [t1, t2].filter((t) => t >= 0);
  if (!candidates.length) return null;
  const t = Math.min(...candidates);
  return { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
}

/** Axis-aligned rect ray intersection. */
export function intersectRayRect(bounds: Rect, origin: Point, direction: Vec2): Point | null {
  return intersectRayPolygon(rectPolygon(bounds), origin, direction);
}

export function rectPolygon(bounds: Rect): Point[] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersect =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y + 1e-12) + pi.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInEllipse(point: Point, bounds: Rect): boolean {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  if (rx <= 0 || ry <= 0) return false;
  const dx = (point.x - cx) / rx;
  const dy = (point.y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

export function polygonToPath(points: Point[], close = true): string {
  if (!points.length) return "";
  const [first, ...rest] = points;
  let d = `M ${first!.x} ${first!.y}`;
  for (const p of rest) d += ` L ${p.x} ${p.y}`;
  if (close) d += " Z";
  return d;
}

/**
 * Closed Catmull–Rom spline as cubic Béziers.
 * Yields smooth SVG path data (`C` commands) from a polygon of control points.
 */
export function closedCatmullRomToPath(points: Point[]): string {
  if (points.length < 3) return polygonToPath(points);
  const n = points.length;
  const first = points[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return `${d} Z`;
}

/** Inscribed content rect as a fraction of geometry bounds, centered. */
export function centeredContentRect(bounds: Rect, widthRatio: number, heightRatio: number): Rect {
  const w = bounds.width * widthRatio;
  const h = bounds.height * heightRatio;
  return {
    x: bounds.x + (bounds.width - w) / 2,
    y: bounds.y + (bounds.height - h) / 2,
    width: w,
    height: h,
  };
}

/** Stroke expands visual bounds by half stroke on each side. */
export function strokeOutset(strokeWidth: number): number {
  return Math.max(0, strokeWidth / 2);
}
