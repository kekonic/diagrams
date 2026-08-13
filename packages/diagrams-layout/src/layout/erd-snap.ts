import type { GraphModel, Point, Rect } from "@kekonic/diagrams-core";
import { findColumnIndex } from "@kekonic/diagrams-core";
import type { LayoutResult, LayoutEdgePath } from "../layout/types.ts";
import { columnAnchorY, isErdTableNode } from "../measure/table-measure.ts";

type Side = "left" | "right";

const OUTER_CLEARANCE = 18;

/**
 * Snap ERD edge endpoints to column midlines while preserving orthogonal routes.
 * Runs after ELK; before crossing treatment / trim.
 */
export function snapErdEdgeEndpoints(
  graph: GraphModel,
  layout: LayoutResult,
  edgePaths: LayoutEdgePath[],
): LayoutEdgePath[] {
  const nodeMap = new Map(layout.nodes.map((n) => [n.nodeId, n]));
  const graphNodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const obstacles = layout.nodes.map((n) => ({ nodeId: n.nodeId, rect: n.bounds }));

  return edgePaths.map((path) => {
    const edge = graph.edges.find((e) => e.id === path.edgeId);
    if (!edge || (!edge.fromColumn && !edge.toColumn)) return path;
    if (path.points.length < 2) return path;

    const fromNode = graphNodes.get(edge.from);
    const toNode = graphNodes.get(edge.to);
    const fromLaid = nodeMap.get(edge.from);
    const toLaid = nodeMap.get(edge.to);
    if (!fromNode || !toNode || !fromLaid || !toLaid) return path;

    let fromY: number | undefined;
    let toY: number | undefined;

    if (edge.fromColumn && isErdTableNode(fromNode)) {
      const row = findColumnIndex(fromNode.columns, edge.fromColumn);
      if (row >= 0) fromY = columnAnchorY(fromLaid.bounds.y, row, fromNode.scale ?? 1);
    }
    if (edge.toColumn && isErdTableNode(toNode)) {
      const row = findColumnIndex(toNode.columns, edge.toColumn);
      if (row >= 0) toY = columnAnchorY(toLaid.bounds.y, row, toNode.scale ?? 1);
    }
    if (fromY == null && toY == null) return path;

    const sides = pickAttachmentSides(fromLaid.bounds, toLaid.bounds, path.points);
    const start = pointOnSide(fromLaid.bounds, sides.fromSide, fromY ?? path.points[0]!.y);
    const end = pointOnSide(
      toLaid.bounds,
      sides.toSide,
      toY ?? path.points[path.points.length - 1]!.y,
    );

    let points = rebuildOrthogonal(start, end, path.points, sides);
    // If the preferred outer side still clips an unrelated table, try the opposite outer side.
    if (
      sides.fromSide === sides.toSide &&
      pathCrossesObstacles(points, obstacles, edge.from, edge.to)
    ) {
      const flipped: Side = sides.fromSide === "left" ? "right" : "left";
      const altSides = { fromSide: flipped, toSide: flipped };
      const altStart = pointOnSide(fromLaid.bounds, flipped, start.y);
      const altEnd = pointOnSide(toLaid.bounds, flipped, end.y);
      const alt = rebuildOrthogonal(altStart, altEnd, path.points, altSides);
      if (!pathCrossesObstacles(alt, obstacles, edge.from, edge.to)) {
        points = alt;
      }
    }

    return { ...path, points };
  });
}

/** Choose left/right faces. Facing sides when horizontally separated; shared outer side when stacked. */
export function pickAttachmentSides(
  fromBounds: Rect,
  toBounds: Rect,
  original: Point[],
): { fromSide: Side; toSide: Side } {
  const fromRight = fromBounds.x + fromBounds.width;
  const toRight = toBounds.x + toBounds.width;
  const gapToRight = toBounds.x - fromRight;
  const gapToLeft = fromBounds.x - toRight;

  if (gapToRight > 0) return { fromSide: "right", toSide: "left" };
  if (gapToLeft > 0) return { fromSide: "left", toSide: "right" };

  // Overlapping X ranges (typical TD stacks): exit/enter on the same outer side so the
  // vertical run stays outside both cards instead of cutting through them.
  const fromMid = fromBounds.x + fromBounds.width / 2;
  const hint = original[0];
  const preferLeft = hint ? hint.x <= fromMid : true;
  const side: Side = preferLeft ? "left" : "right";
  return { fromSide: side, toSide: side };
}

function pointOnSide(bounds: Rect, side: Side, y: number): Point {
  return {
    x: side === "left" ? bounds.x : bounds.x + bounds.width,
    y,
  };
}

function rebuildOrthogonal(
  start: Point,
  end: Point,
  original: Point[],
  sides: { fromSide: Side; toSide: Side },
): Point[] {
  if (Math.abs(start.y - end.y) < 0.5) {
    return [start, end];
  }
  if (Math.abs(start.x - end.x) < 0.5) {
    return [start, end];
  }

  // Same-side attachments: route around the outside, not between the faces.
  if (sides.fromSide === sides.toSide) {
    const midX =
      sides.fromSide === "left"
        ? Math.min(start.x, end.x) - OUTER_CLEARANCE
        : Math.max(start.x, end.x) + OUTER_CLEARANCE;
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  }

  // Facing sides: two-bend route through the clear horizontal gap.
  const lo = Math.min(start.x, end.x);
  const hi = Math.max(start.x, end.x);
  let midX = (start.x + end.x) / 2;
  const interior = original.slice(1, -1);
  if (interior.length) {
    const xs = interior.map((p) => p.x).sort((a, b) => a - b);
    const candidate = xs[Math.floor(xs.length / 2)]!;
    if (candidate >= lo && candidate <= hi) midX = candidate;
  }

  return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
}

function pathCrossesObstacles(
  points: Point[],
  obstacles: Array<{ nodeId: string; rect: Rect }>,
  fromId: string,
  toId: string,
): boolean {
  const exclude = new Set([fromId, toId]);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    for (const { nodeId, rect } of obstacles) {
      if (exclude.has(nodeId)) continue;
      if (segmentHitsRectInterior(a, b, rect)) return true;
    }
  }
  return false;
}

/** True when an orthogonal segment enters the open interior of a rect (not just grazing a face). */
function segmentHitsRectInterior(from: Point, to: Point, rect: Rect): boolean {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const eps = 0.75;

  if (Math.abs(from.y - to.y) < eps) {
    const y = from.y;
    if (y <= top + eps || y >= bottom - eps) return false;
    const x0 = Math.min(from.x, to.x);
    const x1 = Math.max(from.x, to.x);
    return x0 < right - eps && x1 > left + eps;
  }

  if (Math.abs(from.x - to.x) < eps) {
    const x = from.x;
    if (x <= left + eps || x >= right - eps) return false;
    const y0 = Math.min(from.y, to.y);
    const y1 = Math.max(from.y, to.y);
    return y0 < bottom - eps && y1 > top + eps;
  }

  return false;
}

export function erdRelationshipLabel(edge: {
  fromColumn?: string;
  toColumn?: string;
  label?: string;
}): string | undefined {
  if (edge.fromColumn && edge.toColumn) {
    return `${edge.toColumn} → ${edge.fromColumn}`;
  }
  if (edge.toColumn) return edge.toColumn;
  if (edge.fromColumn) return edge.fromColumn;
  return edge.label;
}

// Re-export geometry helpers used by finalize / render.
export { columnAnchorY };
