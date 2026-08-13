import type { Point } from "@kekonic/diagrams-core";
import type { RouteMode } from "@kekonic/diagrams-core";
import type { RenderedEdgeSegment } from "@kekonic/diagrams-routing";

export type EdgePathOptions = {
  route?: RouteMode;
  cornerRadius?: number;
};

const DEFAULT_CORNER_RADIUS = 10;
const METRO_CORNER_RADIUS = 16;

export function edgeStrokePath(
  segments: RenderedEdgeSegment[],
  options: EdgePathOptions = {},
): string {
  const linePoints = segmentsToPoints(segments);
  if (linePoints.length < 2) return "";

  const route = options.route ?? "metro";
  if (route === "bezier") return bezierPath(linePoints);
  if (route === "rounded" || route === "metro") {
    const radius =
      options.cornerRadius ?? (route === "metro" ? METRO_CORNER_RADIUS : DEFAULT_CORNER_RADIUS);
    return roundedOrthogonalPath(linePoints, radius);
  }
  return polylinePath(linePoints);
}

function segmentsToPoints(segments: RenderedEdgeSegment[]): Point[] {
  const points: Point[] = [];
  for (const seg of segments) {
    if (seg.type === "line") {
      if (!points.length) points.push(seg.from);
      points.push(seg.to);
    } else if (seg.type === "jump") {
      if (!points.length) points.push(seg.from);
      const mx = (seg.from.x + seg.to.x) / 2;
      const my = (seg.from.y + seg.to.y) / 2;
      points.push({ x: mx, y: my - seg.radius });
      points.push(seg.to);
    }
    // gap segments intentionally omit points — the stroke breaks at crossings
  }
  return dedupePoints(points);
}

function dedupePoints(points: Point[]): Point[] {
  const result: Point[] = [];
  for (const p of points) {
    const prev = result[result.length - 1];
    if (prev && prev.x === p.x && prev.y === p.y) continue;
    result.push(p);
  }
  return result;
}

function polylinePath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function roundedOrthogonalPath(points: Point[], radius: number): string {
  if (points.length < 2) return "";
  if (points.length === 2) return polylinePath(points);

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const next = points[i + 1]!;
    const inDx = curr.x - prev.x;
    const inDy = curr.y - prev.y;
    const outDx = next.x - curr.x;
    const outDy = next.y - curr.y;
    const inLen = Math.hypot(inDx, inDy) || 1;
    const outLen = Math.hypot(outDx, outDy) || 1;
    const r = Math.min(radius, inLen / 2, outLen / 2);
    const before = { x: curr.x - (inDx / inLen) * r, y: curr.y - (inDy / inLen) * r };
    const after = { x: curr.x + (outDx / outLen) * r, y: curr.y + (outDy / outLen) * r };
    d += ` L ${before.x} ${before.y} Q ${curr.x} ${curr.y} ${after.x} ${after.y}`;
  }
  const last = points[points.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function bezierPath(points: Point[]): string {
  if (points.length === 2) {
    const [from, to] = points;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const c1 = { x: from.x + dx * 0.35, y: from.y };
    const c2 = { x: to.x - dx * 0.35, y: to.y };
    if (Math.abs(dx) < Math.abs(dy)) {
      c1.x = from.x;
      c1.y = from.y + dy * 0.35;
      c2.x = to.x;
      c2.y = to.y - dy * 0.35;
    }
    return `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`;
  }

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const cp1 = {
      x: p1.x + (p2.x - p0.x) / 6,
      y: p1.y + (p2.y - p0.y) / 6,
    };
    const cp2 = {
      x: p2.x - (p3.x - p1.x) / 6,
      y: p2.y - (p3.y - p1.y) / 6,
    };
    d += ` C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}
