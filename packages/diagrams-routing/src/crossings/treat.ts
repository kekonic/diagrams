import type { EdgeArrows, EdgeKind, Point } from "@kekonic/diagrams-core";
import type { CrossingMode } from "@kekonic/diagrams-core";
import { DEFAULT_STROKE_WIDTH, strokeOutset } from "@kekonic/diagrams-geometry";
import type { RoutedEdge } from "../routing/types.ts";

/** Arrow triangle in marker space: base at x=1.5, tip at x=9. */
export const ARROW_MARKER_BASE_X = 1.5;
export const ARROW_MARKER_TIP_X = 9;
/** SVG marker refX — path end sits on the arrow *base* so the stroke does not run under the fill. */
export const ARROW_MARKER_REF_X = ARROW_MARKER_BASE_X;
/** Tip extends past the path end (toward the node) by this much. */
export const ARROW_MARKER_TIP_OVERHANG = ARROW_MARKER_TIP_X - ARROW_MARKER_BASE_X;
/**
 * Attach lives on the fill silhouette (stroke centerline). Pull the path back by
 * half the node stroke plus a hairline so the marker tip sits on the outer ink.
 */
export const ARROW_NODE_GAP = strokeOutset(DEFAULT_STROKE_WIDTH) + 0.25;
/** Target trim: tip lands on the outer node stroke; dash/solid stop at the arrow base. */
export const ARROW_ENDPOINT_INSET = ARROW_MARKER_TIP_OVERHANG + ARROW_NODE_GAP;
/** Kinds that paint `flow-arrow` markers — keep trim in sync with the SVG renderer. */
const FLOW_ARROW_KINDS: ReadonlySet<EdgeKind> = new Set([
  "sync",
  "async",
  "eventual",
  "dependency",
  "failure",
]);

export type FlowArrowEnds = { start: boolean; end: boolean };

/** Whether an edge paints flow arrowheads at the path start and/or end. */
export function flowArrowEnds(
  edge: { kind: EdgeKind; arrows?: EdgeArrows } | undefined,
  showArrowheads: boolean,
): FlowArrowEnds {
  if (!showArrowheads || edge == null || !FLOW_ARROW_KINDS.has(edge.kind)) {
    return { start: false, end: false };
  }
  const arrows = edge.arrows ?? "end";
  if (arrows === "none") return { start: false, end: false };
  return {
    start: arrows === "start" || arrows === "both",
    end: arrows === "end" || arrows === "both",
  };
}

/**
 * Crow's-foot tip sits on the path endpoint (marker refX), unlike arrows whose tip
 * overhangs past refX. Keep only a hairline gap so the tip kisses the table stroke.
 */
export const CARDINALITY_ENDPOINT_INSET = ARROW_NODE_GAP;
/** Small inset for edges without arrowheads — clears node stroke at connection. */
export const EDGE_ENDPOINT_INSET = 1;
/** Ignore crossings this close to a segment end — gaps there orphan markers on stubs. */
const CROSSING_ENDPOINT_CLEARANCE = 28;
/** Crossings within this distance form a dense cluster (prefer gaps in smart mode). */
const SMART_CLUSTER_PX = 48;
/** Prefer gaps when a crossing sits this close to a polyline bend. */
const SMART_CORNER_CLEARANCE = 24;

export type RenderedEdgeSegment =
  | { type: "line"; from: Point; to: Point }
  | { type: "cubic"; from: Point; c1: Point; c2: Point; to: Point }
  | { type: "gap"; from: Point; to: Point }
  | { type: "jump"; from: Point; to: Point; radius: number };

export type TreatedEdge = {
  edgeId: string;
  segments: RenderedEdgeSegment[];
};

type CrossingHit = {
  hop: { edgeId: string; idx: number; from: Point; to: Point };
  under: { edgeId: string; idx: number; from: Point; to: Point };
  point: Point;
};

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Mark crossings that sit in a dense local cluster (≥2 within SMART_CLUSTER_PX). */
function denseCrossingIndexes(crossings: CrossingHit[]): Set<number> {
  const dense = new Set<number>();
  for (let i = 0; i < crossings.length; i++) {
    let neighbors = 0;
    for (let j = 0; j < crossings.length; j++) {
      if (i === j) continue;
      if (dist(crossings[i]!.point, crossings[j]!.point) <= SMART_CLUSTER_PX) neighbors++;
    }
    if (neighbors >= 1) dense.add(i);
  }
  return dense;
}

function nearPolylineCorner(edges: RoutedEdge[], edgeId: string, point: Point): boolean {
  const edge = edges.find((e) => e.edgeId === edgeId);
  if (!edge || edge.points.length < 3) return false;
  // Intermediate points are bends; endpoints are already cleared separately.
  for (let i = 1; i < edge.points.length - 1; i++) {
    if (dist(edge.points[i]!, point) <= SMART_CORNER_CLEARANCE) return true;
  }
  return false;
}

/**
 * Decide gap vs jump for smart mode (§14.3):
 * - isolated orthogonal crossings → jumps
 * - dense clusters → gaps
 * - crossings near corners → gaps (jumps look noisy on bends)
 */
function smartUsesJump(
  crossing: CrossingHit,
  index: number,
  dense: Set<number>,
  edges: RoutedEdge[],
): boolean {
  if (dense.has(index)) return false;
  if (nearPolylineCorner(edges, crossing.hop.edgeId, crossing.point)) return false;
  if (nearPolylineCorner(edges, crossing.under.edgeId, crossing.point)) return false;
  return true;
}

function strokeSegments(edge: RoutedEdge): RenderedEdgeSegment[] {
  if (edge.cubics?.length) {
    return edge.cubics.map((c) => ({
      type: "cubic" as const,
      from: c.from,
      c1: c.c1,
      c2: c.c2,
      to: c.to,
    }));
  }
  return edge.segments.map((s) => ({ type: "line" as const, from: s.from, to: s.to }));
}

export function applyCrossingTreatment(edges: RoutedEdge[], mode: CrossingMode): TreatedEdge[] {
  if (mode === "none") {
    return edges.map((e) => ({
      edgeId: e.edgeId,
      segments: strokeSegments(e),
    }));
  }

  const allSegments: Array<{ edgeId: string; idx: number; from: Point; to: Point }> = [];
  for (const edge of edges) {
    edge.segments.forEach((s, idx) =>
      allSegments.push({ edgeId: edge.edgeId, idx, from: s.from, to: s.to }),
    );
  }

  const crossings: CrossingHit[] = [];
  for (let i = 0; i < allSegments.length; i++) {
    for (let j = i + 1; j < allSegments.length; j++) {
      const a = allSegments[i]!;
      const b = allSegments[j]!;
      if (a.edgeId === b.edgeId) continue;
      const pt = segmentIntersection(a.from, a.to, b.from, b.to);
      if (!pt) continue;
      // Hop the more horizontal segment (classic metro/schematic bridge look).
      const aHoriz = Math.abs(a.from.y - a.to.y) <= Math.abs(a.from.x - a.to.x);
      const hop = aHoriz ? a : b;
      const under = hop === a ? b : a;
      crossings.push({ hop, under, point: pt });
    }
  }

  const dense = mode === "smart" ? denseCrossingIndexes(crossings) : new Set<number>();

  /** Per hop-segment key → list of {point, useJump} */
  const treatmentsAt = new Map<string, Array<{ point: Point; useJump: boolean }>>();
  crossings.forEach((c, index) => {
    const key = `${c.hop.edgeId}:${c.hop.idx}`;
    if (!treatmentsAt.has(key)) treatmentsAt.set(key, []);
    const useJump =
      mode === "jumps" ? true : mode === "gaps" ? false : smartUsesJump(c, index, dense, edges);
    treatmentsAt.get(key)!.push({ point: c.point, useJump });
  });

  const jumpRadius = 10;

  return edges.map((edge) => {
    const segments: RenderedEdgeSegment[] = [];
    edge.segments.forEach((s, idx) => {
      const key = `${edge.edgeId}:${idx}`;
      const points = treatmentsAt.get(key) ?? [];
      if (!points.length) {
        segments.push({ type: "line", from: s.from, to: s.to });
        return;
      }
      const segLen = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) || 1;
      const sorted = points
        .map((p) => ({ ...p, t: paramOnSegment(s.from, s.to, p.point) }))
        .filter((x) => {
          const fromStart = x.t * segLen;
          const fromEnd = (1 - x.t) * segLen;
          return fromStart > CROSSING_ENDPOINT_CLEARANCE && fromEnd > CROSSING_ENDPOINT_CLEARANCE;
        })
        .sort((a, b) => a.t - b.t);

      let prev = s.from;
      for (const { point: p, useJump } of sorted) {
        const t = paramOnSegment(s.from, s.to, p);
        const half = Math.min(
          0.04,
          Math.max(0.015, 8 / (Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) || 1)),
        );
        const gapStart = lerp(s.from, s.to, Math.max(0, t - half));
        const gapEnd = lerp(s.from, s.to, Math.min(1, t + half));
        segments.push({ type: "line", from: prev, to: gapStart });
        if (useJump) {
          segments.push({ type: "jump", from: gapStart, to: gapEnd, radius: jumpRadius });
        } else {
          segments.push({ type: "gap", from: gapStart, to: gapEnd });
        }
        prev = gapEnd;
      }
      segments.push({ type: "line", from: prev, to: s.to });
    });
    return { edgeId: edge.edgeId, segments };
  });
}

function segmentIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
  // Prefer orthogonal H∩V detection — common for ELK routes and tolerant of float noise.
  const eps = 0.75;
  const aH = Math.abs(a1.y - a2.y) < eps;
  const aV = Math.abs(a1.x - a2.x) < eps;
  const bH = Math.abs(b1.y - b2.y) < eps;
  const bV = Math.abs(b1.x - b2.x) < eps;

  if (aH && bV) {
    const y = (a1.y + a2.y) / 2;
    const x = (b1.x + b2.x) / 2;
    if (between(x, a1.x, a2.x) && between(y, b1.y, b2.y)) return { x, y };
    return null;
  }
  if (aV && bH) {
    const x = (a1.x + a2.x) / 2;
    const y = (b1.y + b2.y) / 2;
    if (between(y, a1.y, a2.y) && between(x, b1.x, b2.x)) return { x, y };
    return null;
  }

  const d = (a2.x - a1.x) * (b2.y - b1.y) - (a2.y - a1.y) * (b2.x - b1.x);
  if (Math.abs(d) < 1e-6) return null;
  const t = ((b1.x - a1.x) * (b2.y - b1.y) - (b1.y - a1.y) * (b2.x - b1.x)) / d;
  const u = ((b1.x - a1.x) * (a2.y - a1.y) - (b1.y - a1.y) * (a2.x - a1.x)) / d;
  if (t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98) {
    return { x: a1.x + t * (a2.x - a1.x), y: a1.y + t * (a2.y - a1.y) };
  }
  return null;
}

/** Crossing points between distinct edge segments (for label scoring). */
export function detectCrossingPoints(edges: RoutedEdge[]): Point[] {
  const allSegments: Array<{ edgeId: string; from: Point; to: Point }> = [];
  for (const edge of edges) {
    for (const s of edge.segments) {
      allSegments.push({ edgeId: edge.edgeId, from: s.from, to: s.to });
    }
  }
  const points: Point[] = [];
  for (let i = 0; i < allSegments.length; i++) {
    for (let j = i + 1; j < allSegments.length; j++) {
      const a = allSegments[i]!;
      const b = allSegments[j]!;
      if (a.edgeId === b.edgeId) continue;
      const pt = segmentIntersection(a.from, a.to, b.from, b.to);
      if (pt) points.push(pt);
    }
  }
  return points;
}

function between(v: number, a: number, b: number, pad = 1): boolean {
  const lo = Math.min(a, b) + pad;
  const hi = Math.max(a, b) - pad;
  return v > lo && v < hi;
}

function paramOnSegment(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return 0;
  return ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export type TrimEdgeEndpointsOptions = {
  /** Uniform source inset, or per-edge via callback. */
  sourceInset?: number | ((edgeId: string) => number);
  /** Uniform target inset, or per-edge via callback. */
  targetInset?: number | ((edgeId: string) => number);
};

/** Leave at least this much of a path when the whole run is shorter than the inset. */
const MIN_ENDPOINT_STUB = 1.5;

/** Shorten first/last strokes so arrowheads stop on the outer node stroke. */
export function trimEdgeEndpoints(
  edges: TreatedEdge[],
  options: TrimEdgeEndpointsOptions = {},
): TreatedEdge[] {
  const sourceInsetOpt = options.sourceInset ?? EDGE_ENDPOINT_INSET;
  const targetInsetOpt = options.targetInset ?? EDGE_ENDPOINT_INSET;

  return edges.map((edge) => {
    const sourceInset =
      typeof sourceInsetOpt === "function" ? sourceInsetOpt(edge.edgeId) : sourceInsetOpt;
    const targetInset =
      typeof targetInsetOpt === "function" ? targetInsetOpt(edge.edgeId) : targetInsetOpt;
    if (sourceInset <= 0 && targetInset <= 0) return edge;

    const segments = edge.segments.map((s) => cloneStrokeSegment(s));
    if (sourceInset > 0) trimStrokeRun(segments, "start", sourceInset);
    if (targetInset > 0) trimStrokeRun(segments, "end", targetInset);
    return { edgeId: edge.edgeId, segments };
  });
}

function isStroke(seg: RenderedEdgeSegment): boolean {
  return seg.type === "line" || seg.type === "cubic";
}

function cloneStrokeSegment(seg: RenderedEdgeSegment): RenderedEdgeSegment {
  if (seg.type === "line") return { ...seg, from: { ...seg.from }, to: { ...seg.to } };
  if (seg.type === "cubic") {
    return {
      ...seg,
      from: { ...seg.from },
      c1: { ...seg.c1 },
      c2: { ...seg.c2 },
      to: { ...seg.to },
    };
  }
  return seg;
}

function trimStrokeRun(
  segments: RenderedEdgeSegment[],
  side: "start" | "end",
  inset: number,
): void {
  const terminal = terminalStrokeIndex(segments, side);
  if (terminal < 0) return;
  const seg = segments[terminal]!;
  if (seg.type === "cubic") {
    if (side === "start") seg.from = insetFromEnd(seg.c1, seg.from, inset);
    else seg.to = insetFromEnd(seg.c2, seg.to, inset);
    return;
  }
  if (seg.type !== "line") return;
  const run = contiguousLineRun(segments, terminal, side);
  const points = polylineFromLineRun(segments, run.start, run.end);
  if (points.length < 2) return;
  const trimmed =
    side === "start" ? trimPolylineFromStart(points, inset) : trimPolylineFromEnd(points, inset);
  replaceLineRun(segments, run.start, run.end, trimmed);
}

function terminalStrokeIndex(segments: RenderedEdgeSegment[], side: "start" | "end"): number {
  if (side === "start") return segments.findIndex(isStroke);
  for (let i = segments.length - 1; i >= 0; i--) {
    if (isStroke(segments[i]!)) return i;
  }
  return -1;
}

/** Line-only run touching `index`, stopping at cubics / gaps / jumps. */
function contiguousLineRun(
  segments: RenderedEdgeSegment[],
  index: number,
  side: "start" | "end",
): { start: number; end: number } {
  let start = index;
  let end = index;
  if (side === "start") {
    while (end + 1 < segments.length && segments[end + 1]!.type === "line") end++;
  } else {
    while (start > 0 && segments[start - 1]!.type === "line") start--;
  }
  return { start, end };
}

function polylineFromLineRun(segments: RenderedEdgeSegment[], start: number, end: number): Point[] {
  const first = segments[start]!;
  if (first.type !== "line") return [];
  const pts: Point[] = [{ ...first.from }, { ...first.to }];
  for (let i = start + 1; i <= end; i++) {
    const seg = segments[i]!;
    if (seg.type !== "line") break;
    pts.push({ ...seg.to });
  }
  return pts;
}

function replaceLineRun(
  segments: RenderedEdgeSegment[],
  start: number,
  end: number,
  points: Point[],
): void {
  const next: RenderedEdgeSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    next.push({ type: "line", from: points[i]!, to: points[i + 1]! });
  }
  segments.splice(start, end - start + 1, ...next);
}

function stubLastSegment(points: Point[], stub: number): Point[] {
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-6) return [{ ...a }, { ...b }];
  const keep = Math.min(stub, len);
  return [{ ...a }, { x: a.x + ((b.x - a.x) / len) * keep, y: a.y + ((b.y - a.y) / len) * keep }];
}

function stubFirstSegment(points: Point[], stub: number): Point[] {
  const a = points[0]!;
  const b = points[1]!;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-6) return [{ ...a }, { ...b }];
  const keep = Math.min(stub, len);
  return [{ x: b.x - ((b.x - a.x) / len) * keep, y: b.y - ((b.y - a.y) / len) * keep }, { ...b }];
}

/** Pull the last vertex back along the polyline by `inset` path length. */
function trimPolylineFromEnd(points: Point[], inset: number): Point[] {
  const out = points.map((p) => ({ ...p }));
  let remaining = inset;
  while (out.length >= 2 && remaining > 1e-9) {
    const a = out[out.length - 2]!;
    const b = out[out.length - 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 1e-9) {
      out.pop();
      continue;
    }
    if (len > remaining) {
      const t = remaining / len;
      out[out.length - 1] = { x: b.x - (b.x - a.x) * t, y: b.y - (b.y - a.y) * t };
      remaining = 0;
      break;
    }
    remaining -= len;
    out.pop();
  }
  return out.length >= 2 ? out : stubLastSegment(points, MIN_ENDPOINT_STUB);
}

/** Pull the first vertex forward along the polyline by `inset` path length. */
function trimPolylineFromStart(points: Point[], inset: number): Point[] {
  const out = points.map((p) => ({ ...p }));
  let remaining = inset;
  while (out.length >= 2 && remaining > 1e-9) {
    const a = out[0]!;
    const b = out[1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len <= 1e-9) {
      out.shift();
      continue;
    }
    if (len > remaining) {
      const t = remaining / len;
      out[0] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      remaining = 0;
      break;
    }
    remaining -= len;
    out.shift();
  }
  return out.length >= 2 ? out : stubFirstSegment(points, MIN_ENDPOINT_STUB);
}

/** Move `end` toward `start` by up to `inset` px, leaving a short stub. */
function insetFromEnd(start: Point, end: Point, inset: number): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return end;
  const effectiveInset = Math.min(inset, Math.max(0, len - MIN_ENDPOINT_STUB));
  return {
    x: end.x - (dx / len) * effectiveInset,
    y: end.y - (dy / len) * effectiveInset,
  };
}
