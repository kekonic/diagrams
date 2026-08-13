/**
 * Snap ELK edge endpoints onto ShapeGeometry perimeters.
 *
 * ELK routes to FIXED_POS pins (one out-port and one in-port per edge) derived
 * from ShapeGeometry.getPortPosition. This pass is the authoritative visual
 * attach: first/last points move onto the silhouette along an orthogonal stub
 * so corridors stay rectilinear and fan-in/out lateral offsets are preserved.
 *
 * ERD column-qualified edges are left alone — `snapErdEdgeEndpoints` owns those.
 */

import type { GraphModel, Point, Vec2 } from "@kekonic/diagrams-core";
import { attachPointOnPerimeter } from "@kekonic/diagrams-geometry";
import type { LaidOutNode, LayoutEdgePath } from "./types.ts";

const EPS = 0.75;

function toward(from: Point, to: Point): Vec2 {
  return { x: to.x - from.x, y: to.y - from.y };
}

function centerOf(bounds: { x: number; y: number; width: number; height: number }): Point {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

/** Prefer the dominant axis so attach rays stay H/V even when ELK left a diagonal stub. */
function orthoDirection(v: Vec2): Vec2 {
  if (Math.abs(v.x) >= Math.abs(v.y)) return { x: Math.sign(v.x) || 1, y: 0 };
  return { x: 0, y: Math.sign(v.y) || 1 };
}

function axisAligned(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS || Math.abs(a.y - b.y) < EPS;
}

function applyOrthoAttach(points: Point[], endIndex: number, hit: Point, direction: Vec2): void {
  const inward = endIndex === 0 ? 1 : endIndex - 1;
  const anchor = points[inward]!;
  if (axisAligned(anchor, hit)) {
    points[endIndex] = hit;
    return;
  }
  // Ray missed the silhouette column/row — bridge with one orthogonal corner.
  const corner =
    Math.abs(direction.y) >= Math.abs(direction.x)
      ? { x: anchor.x, y: hit.y }
      : { x: hit.x, y: anchor.y };
  points[endIndex] = hit;
  if (endIndex === 0) points.splice(1, 0, corner);
  else points.splice(endIndex, 0, corner);
}

/** Aim at the nearest facing side of the bounds so we do not flip H/V on shallow diagonals. */
function directionOntoBounds(
  origin: Point,
  bounds: { x: number; y: number; width: number; height: number },
): Vec2 {
  const L = bounds.x;
  const R = bounds.x + bounds.width;
  const T = bounds.y;
  const B = bounds.y + bounds.height;
  const inX = origin.x >= L - EPS && origin.x <= R + EPS;
  const inY = origin.y >= T - EPS && origin.y <= B + EPS;
  if (origin.y < T && inX) return { x: 0, y: 1 };
  if (origin.y > B && inX) return { x: 0, y: -1 };
  if (origin.x < L && inY) return { x: 1, y: 0 };
  if (origin.x > R && inY) return { x: -1, y: 0 };
  return orthoDirection(toward(origin, centerOf(bounds)));
}

/**
 * Replace path termini with shape-perimeter hits.
 * Attach rays are forced orthogonal; a corner is inserted when needed so the
 * final stub never becomes a diagonal shortcut.
 */
export function snapEdgeEndpointsToGeometry(
  graph: GraphModel,
  nodes: LaidOutNode[],
  edgePaths: LayoutEdgePath[],
): LayoutEdgePath[] {
  const nodeMap = new Map(nodes.map((n) => [n.nodeId, n]));
  const graphNodes = new Map(graph.nodes.map((n) => [n.id, n]));

  return edgePaths.map((path) => {
    const edge = graph.edges.find((e) => e.id === path.edgeId);
    if (!edge || path.points.length < 2) return path;
    if (edge.fromColumn || edge.toColumn) return path;

    const points = path.points.map((p) => ({ x: p.x, y: p.y }));
    const fromLaid = nodeMap.get(edge.from);
    const toLaid = nodeMap.get(edge.to);
    const fromNode = graphNodes.get(edge.from);
    const toNode = graphNodes.get(edge.to);

    if (fromLaid && fromNode) {
      const p1 = points[1]!;
      const direction = directionOntoBounds(p1, fromLaid.bounds);
      const hit = attachPointOnPerimeter({
        shapeId: fromNode.shape,
        bounds: fromLaid.bounds,
        origin: p1,
        direction,
      });
      applyOrthoAttach(points, 0, hit, direction);
    }

    if (toLaid && toNode) {
      const prev = points[points.length - 2]!;
      const direction = directionOntoBounds(prev, toLaid.bounds);
      const hit = attachPointOnPerimeter({
        shapeId: toNode.shape,
        bounds: toLaid.bounds,
        origin: prev,
        direction,
      });
      applyOrthoAttach(points, points.length - 1, hit, direction);
    }

    return { ...path, points };
  });
}
