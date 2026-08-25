import type { GraphEdge, GraphModel, GraphNode, Point, Rect } from "@kekonic/diagrams-core";
import { findColumnIndex, fkColumnsForParent, referencedColumns } from "@kekonic/diagrams-core";
import type { LayoutResult, LayoutEdgePath } from "../layout/types.ts";
import {
  columnAnchorY,
  isErdTableNode,
  TABLE_ROW_H,
  tableHeaderHeight,
} from "../measure/table-measure.ts";

type Side = "left" | "right";

const OUTER_CLEARANCE = 18;

type PlannedSnap = {
  path: LayoutEdgePath;
  skip: boolean;
  start?: Point;
  end?: Point;
  sides?: { fromSide: Side; toSide: Side };
  fromKey?: string;
  toKey?: string;
  fromId?: string;
  toId?: string;
  fromBounds?: Rect;
  toBounds?: Rect;
};

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

  const planned: PlannedSnap[] = edgePaths.map((path) => {
    const edge = graph.edges.find((e) => e.id === path.edgeId);
    if (!edge || (!edge.fromColumn && !edge.toColumn)) return { path, skip: true };
    if (path.points.length < 2) return { path, skip: true };

    const fromNode = graphNodes.get(edge.from);
    const toNode = graphNodes.get(edge.to);
    const fromLaid = nodeMap.get(edge.from);
    const toLaid = nodeMap.get(edge.to);
    if (!fromNode || !toNode || !fromLaid || !toLaid) return { path, skip: true };

    const fromY = anchorYFor(fromNode, toNode, fromLaid.bounds, edge, true);
    const toY = anchorYFor(toNode, fromNode, toLaid.bounds, edge, false);
    if (fromY == null && toY == null) return { path, skip: true };

    const sides = pickAttachmentSides(fromLaid.bounds, toLaid.bounds, path.points);
    const start = pointOnSide(fromLaid.bounds, sides.fromSide, fromY ?? path.points[0]!.y);
    const end = pointOnSide(
      toLaid.bounds,
      sides.toSide,
      toY ?? path.points[path.points.length - 1]!.y,
    );
    return {
      path,
      skip: false,
      start,
      end,
      sides,
      fromId: edge.from,
      toId: edge.to,
      fromBounds: fromLaid.bounds,
      toBounds: toLaid.bounds,
      fromKey: `${edge.from}|${sides.fromSide}|${Math.round(start.y)}`,
      toKey: `${edge.to}|${sides.toSide}|${Math.round(end.y)}`,
    };
  });

  fanOutAttachments(planned, "start");
  fanOutAttachments(planned, "end");

  return planned.map((item) => {
    if (
      item.skip ||
      !item.start ||
      !item.end ||
      !item.sides ||
      !item.fromBounds ||
      !item.toBounds
    ) {
      return item.path;
    }
    const points = routeAvoidingObstacles(
      item.start,
      item.end,
      item.path.points,
      item.sides,
      item.fromBounds,
      item.toBounds,
      obstacles,
      item.fromId ?? "",
      item.toId ?? "",
    );
    return { ...item.path, points };
  });
}

function anchorYFor(
  node: GraphNode,
  peer: GraphNode,
  bounds: Rect,
  edge: GraphEdge,
  isSource: boolean,
): number | undefined {
  const column = isSource ? edge.fromColumn : edge.toColumn;
  if (!column || !isErdTableNode(node)) return undefined;
  const scale = node.scale && node.scale > 0 ? node.scale : 1;
  const headerH = tableHeaderHeight(node, scale);
  const names = involvedColumns(node, peer, column, isSource, edge);
  const ys: number[] = [];
  for (const name of names) {
    const row = findColumnIndex(node.columns, name);
    if (row >= 0) ys.push(columnAnchorY(bounds.y, row, scale, headerH));
  }
  if (ys.length === 0) return undefined;
  return (Math.min(...ys) + Math.max(...ys)) / 2;
}

function involvedColumns(
  node: GraphNode,
  peer: GraphNode,
  column: string,
  isSource: boolean,
  edge: GraphEdge,
): string[] {
  const nodeOwnsFk = node.columns?.some(
    (c) => c.name === column && c.references?.table === peer.id,
  );
  if (nodeOwnsFk) {
    return fkColumnsForParent(node.columns, peer.id, column).map((c) => c.name);
  }
  const childCol = isSource ? edge.toColumn : edge.fromColumn;
  const fks = fkColumnsForParent(peer.columns, node.id, childCol);
  if (fks.length > 1) {
    return [...new Set(fks.flatMap((c) => (c.references ? referencedColumns(c.references) : [])))];
  }
  return [column];
}

function fanOutAttachments(planned: PlannedSnap[], end: "start" | "end"): void {
  const groups = new Map<string, PlannedSnap[]>();
  for (const item of planned) {
    if (item.skip) continue;
    const key = end === "start" ? item.fromKey : item.toKey;
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.path.edgeId.localeCompare(b.path.edgeId));
    const n = group.length;
    const origin = end === "start" ? group[0]!.start!.y : group[0]!.end!.y;
    const spread = Math.min(TABLE_ROW_H - 4, 5 * (n - 1));
    group.forEach((item, i) => {
      const y = origin - spread / 2 + (spread * i) / (n - 1);
      if (end === "start" && item.start) item.start = { ...item.start, y };
      if (end === "end" && item.end) item.end = { ...item.end, y };
    });
  }
}

function routeAvoidingObstacles(
  start: Point,
  end: Point,
  original: Point[],
  sides: { fromSide: Side; toSide: Side },
  fromBounds: Rect,
  toBounds: Rect,
  obstacles: Array<{ nodeId: string; rect: Rect }>,
  fromId: string,
  toId: string,
): Point[] {
  const candidates: Point[][] = [rebuildOrthogonal(start, end, original, sides)];

  if (sides.fromSide === sides.toSide) {
    const flipped: Side = sides.fromSide === "left" ? "right" : "left";
    candidates.push(
      rebuildOrthogonal(
        pointOnSide(fromBounds, flipped, start.y),
        pointOnSide(toBounds, flipped, end.y),
        original,
        { fromSide: flipped, toSide: flipped },
      ),
    );
  } else {
    const lo = Math.min(start.x, end.x);
    const hi = Math.max(start.x, end.x);
    const mids = new Set<number>([(start.x + end.x) / 2]);
    for (const { nodeId, rect } of obstacles) {
      if (nodeId === fromId || nodeId === toId) continue;
      const left = rect.x - OUTER_CLEARANCE;
      const right = rect.x + rect.width + OUTER_CLEARANCE;
      if (left > lo && left < hi) mids.add(left);
      if (right > lo && right < hi) mids.add(right);
    }
    for (const midX of mids) {
      candidates.push([start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]);
    }
    for (const side of ["left", "right"] as Side[]) {
      candidates.push(
        rebuildOrthogonal(
          pointOnSide(fromBounds, side, start.y),
          pointOnSide(toBounds, side, end.y),
          original,
          { fromSide: side, toSide: side },
        ),
      );
    }
  }

  for (const y of detourYs(obstacles, fromId, toId, fromBounds, toBounds, start, end)) {
    candidates.push(detourAroundY(start, end, sides, fromBounds, toBounds, y));
  }

  for (const pts of candidates) {
    if (!pathCrossesObstacles(pts, obstacles, fromId, toId)) return pts;
  }
  return candidates[0]!;
}

function detourYs(
  obstacles: Array<{ nodeId: string; rect: Rect }>,
  fromId: string,
  toId: string,
  fromBounds: Rect,
  toBounds: Rect,
  start: Point,
  end: Point,
): number[] {
  const x0 = Math.min(start.x, end.x, fromBounds.x, toBounds.x);
  const x1 = Math.max(start.x, end.x, fromBounds.x + fromBounds.width, toBounds.x + toBounds.width);
  let top = Math.min(fromBounds.y, toBounds.y, start.y, end.y);
  let bottom = Math.max(
    fromBounds.y + fromBounds.height,
    toBounds.y + toBounds.height,
    start.y,
    end.y,
  );
  for (const { nodeId, rect } of obstacles) {
    if (nodeId === fromId || nodeId === toId) continue;
    if (rect.x + rect.width < x0 || rect.x > x1) continue;
    top = Math.min(top, rect.y);
    bottom = Math.max(bottom, rect.y + rect.height);
  }
  return [top - OUTER_CLEARANCE, bottom + OUTER_CLEARANCE];
}

function detourAroundY(
  start: Point,
  end: Point,
  sides: { fromSide: Side; toSide: Side },
  fromBounds: Rect,
  toBounds: Rect,
  y: number,
): Point[] {
  const fromOut =
    sides.fromSide === "left"
      ? Math.min(start.x, fromBounds.x) - OUTER_CLEARANCE
      : Math.max(start.x, fromBounds.x + fromBounds.width) + OUTER_CLEARANCE;
  const toOut =
    sides.toSide === "left"
      ? Math.min(end.x, toBounds.x) - OUTER_CLEARANCE
      : Math.max(end.x, toBounds.x + toBounds.width) + OUTER_CLEARANCE;
  return [
    start,
    { x: fromOut, y: start.y },
    { x: fromOut, y },
    { x: toOut, y },
    { x: toOut, y: end.y },
    end,
  ];
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
