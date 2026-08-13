import type { Point, Rect } from "@kekonic/diagrams-core";
import type { LayoutEdgePath } from "../types.ts";

const COLINEAR_EPS = 0.75;

/** Floor for edge↔node clearance (layout CSS-px) — room for a bend stub + arrow. */
export const MIN_EDGE_NODE_CLEARANCE = 28;

/** Drop redundant colinear waypoints from orthogonal ELK polylines.
 * Unlike route-orthogonal-avoid's search collapse, this may drop stubs once
 * attach points are frozen by snapEdgeEndpointsToGeometry.
 */
export function collapseColinearPoints(points: Point[], eps = COLINEAR_EPS): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const vertical = Math.abs(a.x - b.x) < eps && Math.abs(b.x - c.x) < eps;
    const horizontal = Math.abs(a.y - b.y) < eps && Math.abs(b.y - c.y) < eps;
    if (vertical || horizontal) continue;
    out.push(b);
  }
  out.push(points[points.length - 1]!);
  return out;
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return Math.min(a0, a1) <= Math.max(b0, b1) && Math.max(a0, a1) >= Math.min(b0, b1);
}

/** Move segment endpoints that are not path termini (attach points stay fixed). */
function setSegmentCoord(out: Point[], segIndex: number, axis: "x" | "y", value: number): void {
  const i = segIndex;
  const last = out.length - 1;
  if (i > 0) out[i]![axis] = value;
  if (i + 1 < last) out[i + 1]![axis] = value;
}

/**
 * Shift orthogonal corridors that run inside the keep-out around node cards
 * so 90° corners aren't parked flush on a shape edge.
 * Path endpoints (port attaches) are never moved.
 */
export function clearOrthogonalCorridors(points: Point[], nodes: Rect[], pad: number): Point[] {
  if (points.length < 3 || nodes.length === 0 || pad <= 0) return points;
  const out = points.map((p) => ({ x: p.x, y: p.y }));

  // A few passes: one shift can put another segment into a neighbor keep-out.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < out.length - 1; i++) {
      // Leave attach stubs alone — shifting only the inner end makes a diagonal.
      if (i === 0 || i === out.length - 2) continue;
      const a = out[i]!;
      const b = out[i + 1]!;
      const vert = Math.abs(a.x - b.x) < COLINEAR_EPS;
      const horz = Math.abs(a.y - b.y) < COLINEAR_EPS;
      if (!vert && !horz) continue;

      for (const box of nodes) {
        const L = box.x;
        const R = box.x + box.width;
        const T = box.y;
        const B = box.y + box.height;

        if (vert) {
          const x = (a.x + b.x) / 2;
          if (!rangesOverlap(a.y, b.y, T - pad, B + pad)) continue;
          if (x > L - pad && x < L) {
            setSegmentCoord(out, i, "x", L - pad);
            moved = true;
          } else if (x > R && x < R + pad) {
            setSegmentCoord(out, i, "x", R + pad);
            moved = true;
          }
        } else {
          const y = (a.y + b.y) / 2;
          if (!rangesOverlap(a.x, b.x, L - pad, R + pad)) continue;
          if (y > T - pad && y < T) {
            setSegmentCoord(out, i, "y", T - pad);
            moved = true;
          } else if (y > B && y < B + pad) {
            setSegmentCoord(out, i, "y", B + pad);
            moved = true;
          }
        }
      }
    }
    if (!moved) break;
  }

  return out;
}

/**
 * Repair any residual non-orthogonal stubs (e.g. ELK diagonal tips) by inserting
 * one corner so metro/rounded stroke rendering never draws a slash to the port.
 */
export function ensureOrthogonalPoints(points: Point[], eps = COLINEAR_EPS): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [{ ...points[0]! }];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1]!;
    const curr = points[i]!;
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);
    if (dx > eps && dy > eps) {
      // Prefer continuing the prior corridor axis when present.
      const before = out.length >= 2 ? out[out.length - 2]! : null;
      const preferVertical = before != null ? Math.abs(before.x - prev.x) < eps : dy >= dx;
      out.push(preferVertical ? { x: prev.x, y: curr.y } : { x: curr.x, y: prev.y });
    }
    out.push({ ...curr });
  }
  return collapseColinearPoints(out, eps);
}

/** Light cleanup — preserve ELK topology; keep bends clear of node cards. */
export function polishEdgePaths(
  paths: LayoutEdgePath[],
  nodes: Rect[] = [],
  edgeNodeClearance = MIN_EDGE_NODE_CLEARANCE,
): LayoutEdgePath[] {
  const pad = Math.max(MIN_EDGE_NODE_CLEARANCE, edgeNodeClearance);
  return paths.map((path) => ({
    ...path,
    points: ensureOrthogonalPoints(
      collapseColinearPoints(clearOrthogonalCorridors(path.points, nodes, pad)),
    ),
  }));
}
