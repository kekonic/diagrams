import type { Point } from "@kekonic/diagrams-core";
import type { CrossingMode } from "@kekonic/diagrams-core";
import type { RoutedEdge } from "../routing/types.ts";

/** Arrow triangle in marker space: base at x=1.5, tip at x=9. */
export const ARROW_MARKER_BASE_X = 1.5;
export const ARROW_MARKER_TIP_X = 9;
/** SVG marker refX — path end sits on the arrow *base* so the stroke does not run under the fill. */
export const ARROW_MARKER_REF_X = ARROW_MARKER_BASE_X;
/** Tip extends past the path end (toward the node) by this much. */
export const ARROW_MARKER_TIP_OVERHANG = ARROW_MARKER_TIP_X - ARROW_MARKER_BASE_X;
/**
 * How far to pull the path endpoint back from the node border.
 * Path end = arrow base; tip overhangs to (approximately) the attach point.
 */
export const ARROW_NODE_GAP = 1.5;
/** Target trim: tip lands just shy of the node stroke; dash/solid stop at the arrow base. */
export const ARROW_ENDPOINT_INSET = ARROW_MARKER_TIP_OVERHANG + ARROW_NODE_GAP;
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

export function applyCrossingTreatment(edges: RoutedEdge[], mode: CrossingMode): TreatedEdge[] {
  if (mode === "none") {
    return edges.map((e) => ({
      edgeId: e.edgeId,
      segments: e.segments.map((s) => ({ type: "line" as const, from: s.from, to: s.to })),
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

/** Shorten first/last line segments so strokes and arrowheads stop before node fills. */
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

    const segments = edge.segments.map((s) =>
      s.type === "line" ? { ...s, from: { ...s.from }, to: { ...s.to } } : s,
    );

    const firstLine = segments.findIndex((s) => s.type === "line");
    let lastLine = -1;
    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i]!.type === "line") {
        lastLine = i;
        break;
      }
    }
    if (firstLine < 0) return { edgeId: edge.edgeId, segments };

    if (sourceInset > 0) {
      const seg = segments[firstLine]!;
      if (seg.type === "line") {
        seg.from = insetFromEnd(seg.to, seg.from, sourceInset);
      }
    }

    if (targetInset > 0 && lastLine >= 0) {
      const seg = segments[lastLine]!;
      if (seg.type === "line") {
        seg.to = insetFromEnd(seg.from, seg.to, targetInset);
      }
    }

    return { edgeId: edge.edgeId, segments };
  });
}

/** Move `end` toward `start` by up to `inset` px, capped to keep a visible stub. */
function insetFromEnd(start: Point, end: Point, inset: number): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return end;
  const effectiveInset = Math.min(inset, len * 0.45);
  return {
    x: end.x - (dx / len) * effectiveInset,
    y: end.y - (dy / len) * effectiveInset,
  };
}
