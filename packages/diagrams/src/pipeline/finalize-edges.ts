import type { GraphModel, Point, Rect, RoutingOptions } from "@kekonic/diagrams-core";
import { isPureCardinalityLabel, rectsOverlap } from "@kekonic/diagrams-core";
import {
  type LayoutResult,
  type LayoutEdgePath,
  snapErdEdgeEndpoints,
  defaultMeasurer,
  DEFAULT_FONT_FAMILY,
  type TextMeasurer,
} from "@kekonic/diagrams-layout";
import {
  applyCrossingTreatment,
  detectCrossingPoints,
  trimEdgeEndpoints,
  refineRouteStyle,
  flowArrowEnds,
  ARROW_ENDPOINT_INSET,
  CARDINALITY_ENDPOINT_INSET,
  EDGE_ENDPOINT_INSET,
  type EdgeLabelPlacement,
  type TreatedEdge,
  type RoutedEdge,
  type CubicBezier,
  EDGE_LABEL_ICON,
  EDGE_LABEL_ICON_GAP,
  EDGE_LABEL_PAD_X,
} from "@kekonic/diagrams-routing";

export type FinalizeElkEdgesInput = {
  graph: GraphModel;
  layout: LayoutResult;
  edgePaths: LayoutEdgePath[];
  routingOpts: RoutingOptions;
  measurer?: TextMeasurer;
};

export type FinalizeElkEdgesResult = {
  labels: EdgeLabelPlacement[];
  treatedEdges: TreatedEdge[];
  routingEdges: RoutedEdge[];
};

/** Match `.flow-edge-label-text` theme (11px / 700). */
const EDGE_LABEL_FONT = {
  fontSize: 11,
  fontFamily: DEFAULT_FONT_FAMILY,
  fontWeight: "700",
} as const;

const EDGE_LABEL_PAD_Y = 5;
/** Prefer anchors this far from path ends / arrowheads. */
const ENDPOINT_SOFT_CLEARANCE = 36;
/** Prefer anchors this far from polyline bends. */
const BEND_SOFT_CLEARANCE = 28;
/** Prefer anchors this far from edge crossings. */
const CROSSING_SOFT_CLEARANCE = 24;

function pathsToRouted(
  paths: LayoutEdgePath[],
  cubicsByEdge?: Map<string, CubicBezier[]>,
): RoutedEdge[] {
  return paths.map((path) => {
    const points = path.points;
    const segments: Array<{ from: Point; to: Point }> = [];
    for (let i = 0; i < points.length - 1; i++) {
      segments.push({ from: points[i]!, to: points[i + 1]! });
    }
    const cubics = cubicsByEdge?.get(path.edgeId);
    return { edgeId: path.edgeId, points, segments, cubics };
  });
}

function measureLabelSize(
  text: string,
  hasIcon: boolean,
  measurer: TextMeasurer,
): { width: number; height: number } {
  const metrics =
    text.length > 0
      ? measurer.measureText(text, EDGE_LABEL_FONT)
      : { width: 0, height: EDGE_LABEL_FONT.fontSize * 1.2 };
  const iconGutter = hasIcon ? EDGE_LABEL_ICON + (text.length > 0 ? EDGE_LABEL_ICON_GAP : 0) : 0;
  const min = hasIcon && text.length === 0 ? 22 : 28;
  const width = Math.max(min, metrics.width + iconGutter + EDGE_LABEL_PAD_X * 2);
  const height = Math.max(18, Math.ceil(metrics.height) + EDGE_LABEL_PAD_Y * 2);
  return { width, height };
}

export { EDGE_LABEL_ICON, EDGE_LABEL_ICON_GAP, EDGE_LABEL_PAD_X };

function overlapArea(a: Rect, b: Rect): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  if (x1 <= x0 || y1 <= y0) return 0;
  return (x1 - x0) * (y1 - y0);
}

function distPoint(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distPointToRect(p: Point, r: Rect): number {
  const cx = Math.min(Math.max(p.x, r.x), r.x + r.width);
  const cy = Math.min(Math.max(p.y, r.y), r.y + r.height);
  return distPoint(p, { x: cx, y: cy });
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    len += distPoint(a, b);
  }
  return len;
}

/** Nearest point on a polyline to `p` (orthogonal or diagonal). */
function nearestOnPath(points: Point[], p: Point): Point {
  let best = points[0] ?? p;
  let bestD = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t =
      len2 < 1e-8 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const q = { x: a.x + dx * t, y: a.y + dy * t };
    const d = distPoint(p, q);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/** Gap between label pill and the stroke — keep pills hugging the path. */
function pathClearance(bounds: Rect, points: Point[]): number {
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const onPath = nearestOnPath(points, { x: cx, y: cy });
  const clamped = {
    x: Math.min(Math.max(onPath.x, bounds.x), bounds.x + bounds.width),
    y: Math.min(Math.max(onPath.y, bounds.y), bounds.y + bounds.height),
  };
  return distPoint(onPath, clamped);
}

function scoreLabelCandidate(
  bounds: Rect,
  anchor: Point,
  obstacles: Rect[],
  points: Point[],
  crossings: Point[],
  alongFrac: number,
  position: "start" | "middle" | "end" | undefined,
  authoredPosition: boolean,
): number {
  let score = 0;
  for (const obs of obstacles) {
    const area = overlapArea(bounds, obs);
    if (area > 0) score += area * 10;
    else if (rectsOverlap(bounds, obs, 4)) score += 4;
  }

  if (points.length >= 2) {
    const start = points[0]!;
    const end = points[points.length - 1]!;
    const dStart = distPoint(anchor, start);
    const dEnd = distPoint(anchor, end);
    if (dStart < ENDPOINT_SOFT_CLEARANCE) score += (ENDPOINT_SOFT_CLEARANCE - dStart) * 2;
    if (dEnd < ENDPOINT_SOFT_CLEARANCE) score += (ENDPOINT_SOFT_CLEARANCE - dEnd) * 2;

    for (let i = 1; i < points.length - 1; i++) {
      const d = distPoint(anchor, points[i]!);
      if (d < BEND_SOFT_CLEARANCE) score += (BEND_SOFT_CLEARANCE - d) * 1.5;
    }
  }

  for (const c of crossings) {
    const d = distPointToRect(c, bounds);
    if (d < CROSSING_SOFT_CLEARANCE) score += (CROSSING_SOFT_CLEARANCE - d) * 3;
  }

  // Bias along the whole polyline (not just the longest segment). Default is a
  // mild middle preference; authored labelPosition uses a stronger weight.
  const preferred = position === "start" ? 0.22 : position === "end" ? 0.78 : 0.5;
  const total = Math.max(1, pathLength(points));
  const weight = authoredPosition ? 3.4 : 0.55;
  score += Math.abs(alongFrac - preferred) * total * weight;

  // Prefer pills that sit beside the stroke — floating gutter parks score poorly.
  const clearance = pathClearance(bounds, points);
  if (clearance > 2) score += (clearance - 2) * 6;

  return score;
}

export type PlaceEdgeLabelOptions = {
  hasIcon?: boolean;
  measurer?: TextMeasurer;
  crossings?: Point[];
  /** Along-path preference (`start` | `middle` | `end`). Default soft-middle. */
  position?: "start" | "middle" | "end";
  /** True when `position` came from authored DSL (stronger bias). */
  authoredPosition?: boolean;
};

/**
 * Place an edge label near a free path segment, preferring positions that miss
 * node cards, corners, endpoints/arrowheads, and crossings.
 */
export function placeEdgeLabel(
  edgeId: string,
  text: string,
  points: Point[],
  obstacles: Rect[],
  endpoints: Rect[] = [],
  options: PlaceEdgeLabelOptions = {},
): EdgeLabelPlacement {
  const measurer = options.measurer ?? defaultMeasurer;
  const crossings = options.crossings ?? [];
  const position = options.position ?? "middle";
  const authoredPosition = options.authoredPosition === true;
  const { width: w, height: h } = measureLabelSize(text, options.hasIcon === true, measurer);
  const midFallback = points[Math.floor(points.length / 2)] ?? { x: 0, y: 0 };
  const totalLen = Math.max(1, pathLength(points));

  type Candidate = { anchor: Point; bounds: Rect; score: number; length: number };
  const candidates: Candidate[] = [];

  const pushCandidate = (anchor: Point, bounds: Rect, length: number, alongFrac: number) => {
    candidates.push({
      anchor,
      bounds,
      score: scoreLabelCandidate(
        bounds,
        anchor,
        obstacles,
        points,
        crossings,
        alongFrac,
        position,
        authoredPosition,
      ),
      length,
    });
  };

  let walked = 0;
  // Keep the pill snug beside the stroke (was 8–12px + diagonal parks).
  const GAP = 4;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const length = distPoint(a, b);
    const fracs = length > 40 ? [0.2, 0.35, 0.5, 0.65, 0.8] : [0.5];
    for (const t of fracs) {
      const anchor = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      const alongFrac = (walked + t * length) / totalLen;
      const dxSeg = b.x - a.x;
      const dySeg = b.y - a.y;
      const vertical = Math.abs(dxSeg) < 0.5;
      const horizontal = Math.abs(dySeg) < 0.5;
      const offsets = vertical
        ? [
            { dx: GAP, dy: -h / 2 },
            { dx: -w - GAP, dy: -h / 2 },
            { dx: GAP, dy: -h - GAP },
            { dx: -w - GAP, dy: -h - GAP },
            { dx: GAP, dy: GAP },
            { dx: -w - GAP, dy: GAP },
          ]
        : horizontal
          ? [
              { dx: -w / 2, dy: -h - GAP },
              { dx: -w / 2, dy: GAP },
              { dx: -w / 2, dy: -h / 2 },
              { dx: -w - GAP, dy: -h / 2 },
              { dx: GAP, dy: -h / 2 },
            ]
          : (() => {
              const len = Math.hypot(dxSeg, dySeg) || 1;
              const nx = (-dySeg / len) * (h / 2 + GAP);
              const ny = (dxSeg / len) * (h / 2 + GAP);
              return [
                { dx: -w / 2 + nx, dy: -h / 2 + ny },
                { dx: -w / 2 - nx, dy: -h / 2 - ny },
                { dx: -w / 2, dy: -h - GAP },
                { dx: -w / 2, dy: GAP },
              ];
            })();
      for (const { dx, dy } of offsets) {
        pushCandidate(
          anchor,
          { x: anchor.x + dx, y: anchor.y + dy, width: w, height: h },
          length,
          alongFrac,
        );
      }
    }
    walked += length;
  }

  // Last resort when the corridor is crushed — park beside a path point, not in
  // the empty AABB middle of a long cross-column hop.
  const cluster = endpoints.length ? endpoints : obstacles;
  if (cluster.length && points.length >= 2) {
    const midFrac = position === "start" ? 0.22 : position === "end" ? 0.78 : 0.5;
    let along = 0;
    const target = midFrac * totalLen;
    let parkOn = points[0]!;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const seg = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (along + seg >= target || i === points.length - 2) {
        const t = seg > 0 ? Math.min(1, Math.max(0, (target - along) / seg)) : 0.5;
        parkOn = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        break;
      }
      along += seg;
    }
    const top = Math.min(...cluster.map((o) => o.y));
    const bottom = Math.max(...cluster.map((o) => o.y + o.height));
    pushCandidate(
      parkOn,
      { x: parkOn.x - w / 2, y: top - h - GAP, width: w, height: h },
      1,
      midFrac,
    );
    pushCandidate(
      parkOn,
      { x: parkOn.x - w / 2, y: bottom + GAP, width: w, height: h },
      1,
      midFrac,
    );
    pushCandidate(
      parkOn,
      { x: parkOn.x + GAP, y: parkOn.y - h / 2, width: w, height: h },
      1,
      midFrac,
    );
    pushCandidate(
      parkOn,
      { x: parkOn.x - w - GAP, y: parkOn.y - h / 2, width: w, height: h },
      1,
      midFrac,
    );
  }

  candidates.sort((c, d) => c.score - d.score || d.length - c.length);
  const best = candidates[0];
  if (best) {
    // Anchor on the stroke nearest the pill so render can draw a short leader.
    const anchor = nearestOnPath(points, {
      x: best.bounds.x + best.bounds.width / 2,
      y: best.bounds.y + best.bounds.height / 2,
    });
    return { edgeId, text, bounds: best.bounds, anchor };
  }

  return {
    edgeId,
    text,
    bounds: { x: midFallback.x - w / 2, y: midFallback.y - h - 6, width: w, height: h },
    anchor: midFallback,
  };
}

function restoreBezierCubics(
  treated: TreatedEdge[],
  cubicsByEdge: Map<string, CubicBezier[]>,
): TreatedEdge[] {
  if (!cubicsByEdge.size) return treated;
  return treated.map((edge) => {
    const cubics = cubicsByEdge.get(edge.edgeId);
    if (!cubics?.length) return edge;
    if (edge.segments.some((s) => s.type === "gap" || s.type === "jump")) return edge;
    return {
      edgeId: edge.edgeId,
      segments: cubics.map((c) => ({
        type: "cubic" as const,
        from: c.from,
        c1: c.c1,
        c2: c.c2,
        to: c.to,
      })),
    };
  });
}

/** ELK labels + ERD column snap + marker inset (silhouette attach already ran in layout). */
export function finalizeElkEdges(input: FinalizeElkEdgesInput): FinalizeElkEdgesResult {
  const { graph, layout, edgePaths, routingOpts } = input;

  // Sequence messages are already laid out; skip ELK crossing polish / ERD snap.
  if (graph.diagramKind === "sequence" || layout.sequence) {
    const routingEdges = pathsToRouted(edgePaths);
    const treatedEdges: TreatedEdge[] = routingEdges.map((e) => ({
      edgeId: e.edgeId,
      segments: e.segments.map((s) => ({ type: "line" as const, from: s.from, to: s.to })),
    }));
    const labels: EdgeLabelPlacement[] = (layout.edgeLabels ?? []).map((l) => ({
      edgeId: l.edgeId,
      text: l.text,
      bounds: l.bounds,
      anchor: l.anchor,
    }));
    return { labels, treatedEdges, routingEdges };
  }

  const measurer = input.measurer ?? defaultMeasurer;
  const snappedPaths = snapErdEdgeEndpoints(graph, layout, edgePaths);
  const routeMode = routingOpts.route ?? "metro";
  const refined = refineRouteStyle(
    snappedPaths.map((path) => {
      const edge = graph.edges.find((e) => e.id === path.edgeId);
      return {
        edgeId: path.edgeId,
        fromId: edge?.from ?? "",
        toId: edge?.to ?? "",
        points: path.points,
      };
    }),
    layout.nodes.map((n) => ({ id: n.nodeId, bounds: n.bounds })),
    routeMode,
    routingOpts.parallel,
    routingOpts.cornerRadius,
  );
  const cubicsByEdge = new Map(
    refined.filter((r) => r.cubics?.length).map((r) => [r.edgeId, r.cubics!]),
  );
  const refinedPaths: LayoutEdgePath[] = refined.map((r) => ({
    edgeId: r.edgeId,
    points: r.points,
  }));
  const routingEdges = pathsToRouted(refinedPaths, cubicsByEdge);
  const crossings = detectCrossingPoints(routingEdges);
  const nodeBounds = new Map(layout.nodes.map((n) => [n.nodeId, n.bounds]));
  const obstacles = layout.nodes.map((n) => n.bounds);

  const labels: EdgeLabelPlacement[] = [];
  const labelObstacles: Rect[] = [];
  for (const edge of graph.edges) {
    const path = refinedPaths.find((p) => p.edgeId === edge.id);
    if (!path || path.points.length < 2) continue;

    const pureCard = Boolean(edge.cardinality && isPureCardinalityLabel(edge.label));

    let text: string | undefined;
    if (edge.fromColumn || edge.toColumn) {
      // Schema relationships rely on crow's-foot markers + column anchors.
      // Skip auto "fk → pk" pills; keep only explicit author text.
      if (edge.label && !pureCard) text = edge.label;
    } else if (edge.label && !pureCard) {
      text = edge.label;
    }

    const hasIcon = Boolean(edge.icon && edge.icon !== "none");

    // Fall back to ELK label placement if we have text but no KDiagram path text.
    if (!text && !hasIcon) {
      const elk = layout.edgeLabels.find((l) => l.edgeId === edge.id);
      if (elk && !pureCard) {
        labels.push({
          edgeId: elk.edgeId,
          text: elk.text,
          bounds: elk.bounds,
          anchor: elk.anchor,
        });
        labelObstacles.push(elk.bounds);
      }
      continue;
    }

    const endpoints = [nodeBounds.get(edge.from), nodeBounds.get(edge.to)].filter(
      (b): b is Rect => b != null,
    );
    const placed = placeEdgeLabel(
      edge.id,
      text ?? "",
      path.points,
      [...obstacles, ...labelObstacles],
      endpoints,
      {
        hasIcon,
        measurer,
        crossings,
        position: edge.labelPosition,
        authoredPosition: edge.labelPosition != null,
      },
    );
    labels.push(placed);
    labelObstacles.push(placed.bounds);
  }

  const treated = restoreBezierCubics(
    applyCrossingTreatment(routingEdges, routingOpts.crossings ?? "none"),
    cubicsByEdge,
  );
  const showArrowheads = routingOpts.arrowheads !== false;
  const trimmed = trimEdgeEndpoints(treated, {
    sourceInset: (edgeId) => {
      const edge = graph.edges.find((e) => e.id === edgeId);
      if (edge?.cardinality) return CARDINALITY_ENDPOINT_INSET;
      return flowArrowEnds(edge, showArrowheads).start ? ARROW_ENDPOINT_INSET : EDGE_ENDPOINT_INSET;
    },
    targetInset: (edgeId) => {
      const edge = graph.edges.find((e) => e.id === edgeId);
      if (edge?.cardinality) return CARDINALITY_ENDPOINT_INSET;
      return flowArrowEnds(edge, showArrowheads).end ? ARROW_ENDPOINT_INSET : EDGE_ENDPOINT_INSET;
    },
  });

  return { labels, treatedEdges: trimmed, routingEdges };
}
