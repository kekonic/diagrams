import type { Point, Rect } from "../types.ts";
import { DEFAULT_STROKE_WIDTH } from "../types.ts";
import {
  type ShapeGeometry,
  defaultLayoutFootprint,
  defaultPortNormal,
  defaultVisualBounds,
  projectSidePortOntoPolygon,
} from "../shape-geometry.ts";
import { centeredContentRect, intersectRayPolygon, pointInPolygon } from "../math.ts";

/**
 * Material Design cloud scaled into bounds.
 * Flat base, soft lobes — proven silhouette (24×24 viewBox, content y∈[4,20]).
 */
const VB = { x: 0, y: 4, w: 24, h: 16 };
/** Intrinsic cloud aspect (viewBox content width / height). */
const CLOUD_ASPECT = VB.w / VB.h;

type Seg = { type: "C"; c1: Point; c2: Point; end: Point } | { type: "L"; end: Point };

/**
 * Largest 3:2 rect centered in `bounds`. Non-uniform stretch turns lobes into a
 * sausage; letterbox so the silhouette stays cloud-shaped even if layout is tall.
 */
function fitCloudBounds(bounds: Rect): Rect {
  const boxAspect = bounds.width / Math.max(bounds.height, 1e-6);
  if (boxAspect >= CLOUD_ASPECT) {
    const width = bounds.height * CLOUD_ASPECT;
    return {
      x: bounds.x + (bounds.width - width) / 2,
      y: bounds.y,
      width,
      height: bounds.height,
    };
  }
  const height = bounds.width / CLOUD_ASPECT;
  return {
    x: bounds.x,
    y: bounds.y + (bounds.height - height) / 2,
    width: bounds.width,
    height,
  };
}

function map(bounds: Rect, px: number, py: number): Point {
  return {
    x: bounds.x + ((px - VB.x) / VB.w) * bounds.width,
    y: bounds.y + ((py - VB.y) / VB.h) * bounds.height,
  };
}

function cloudSegments(bounds: Rect): { start: Point; segs: Seg[] } {
  const fitted = fitCloudBounds(bounds);
  const p = (x: number, y: number) => map(fitted, x, y);
  return {
    start: p(19.35, 10.04),
    segs: [
      { type: "C", c1: p(18.67, 6.59), c2: p(15.64, 4), end: p(12, 4) },
      { type: "C", c1: p(9.11, 4), c2: p(6.6, 5.64), end: p(5.35, 8.04) },
      { type: "C", c1: p(2.34, 8.36), c2: p(0, 10.91), end: p(0, 14) },
      { type: "C", c1: p(0, 17.31), c2: p(2.69, 20), end: p(6, 20) },
      { type: "L", end: p(19, 20) },
      { type: "C", c1: p(21.76, 20), c2: p(24, 17.76), end: p(24, 15) },
      { type: "C", c1: p(24, 12.36), c2: p(21.95, 10.22), end: p(19.35, 10.04) },
    ],
  };
}

function sampleCubic(p0: Point, p1: Point, p2: Point, p3: Point, steps: number): Point[] {
  const pts: Point[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return pts;
}

/** Hit-test / port polygon matching the Material silhouette. */
export function cloudSamplePolygon(bounds: Rect, stepsPerCurve = 10): Point[] {
  const { start, segs } = cloudSegments(bounds);
  const pts: Point[] = [start];
  let cur = start;
  for (const seg of segs) {
    if (seg.type === "L") {
      pts.push(seg.end);
      cur = seg.end;
    } else {
      pts.push(...sampleCubic(cur, seg.c1, seg.c2, seg.end, stepsPerCurve));
      cur = seg.end;
    }
  }
  return pts;
}

/** Material cloud path scaled into the node box. */
export function cloudPath(bounds: Rect): string {
  const { start, segs } = cloudSegments(bounds);
  let d = `M ${start.x} ${start.y}`;
  for (const seg of segs) {
    if (seg.type === "L") {
      d += ` L ${seg.end.x} ${seg.end.y}`;
    } else {
      d += ` C ${seg.c1.x} ${seg.c1.y}, ${seg.c2.x} ${seg.c2.y}, ${seg.end.x} ${seg.end.y}`;
    }
  }
  return `${d} Z`;
}

export const cloudGeometry: ShapeGeometry = {
  id: "cloud",
  defaultSize: { width: 160, height: 100 },
  minSize: { width: 80, height: 56 },
  defaultPadding: { top: 20, right: 24, bottom: 20, left: 24 },
  contentPolicy: {
    align: "center",
    maxLabelLines: 2,
    preferExternalLabel: false,
    iconPlacement: "centered",
  },

  getPath(bounds) {
    return { d: cloudPath(bounds), polygon: cloudSamplePolygon(bounds) };
  },

  getContentBounds(bounds, style = {}) {
    const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    const fitted = fitCloudBounds(bounds);
    const content = centeredContentRect(fitted, 0.55, 0.42);
    content.y = fitted.y + fitted.height * 0.38;
    return {
      x: content.x + stroke,
      y: content.y + stroke,
      width: Math.max(0, content.width - stroke * 2),
      height: Math.max(0, content.height - stroke * 2),
    };
  },

  getVisualBounds(bounds, style) {
    return defaultVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(cloudGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds) {
    return projectSidePortOntoPolygon(
      port,
      bounds,
      cloudSamplePolygon(bounds),
      intersectRayPolygon,
    );
  },

  getPortNormal(port, bounds) {
    return defaultPortNormal(port, bounds);
  },

  intersectRay(bounds, origin, direction) {
    return intersectRayPolygon(cloudSamplePolygon(bounds), origin, direction);
  },

  containsPoint(bounds, point) {
    return pointInPolygon(point, cloudSamplePolygon(bounds));
  },
};
