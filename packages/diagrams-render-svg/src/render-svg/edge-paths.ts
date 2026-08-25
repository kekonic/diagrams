import type { Point } from "@kekonic/diagrams-core";
import type { RouteMode } from "@kekonic/diagrams-core";
import { cubicsToPath, fitOrganicRoute, type CubicBezier } from "@kekonic/diagrams-routing";
import type { RenderedEdgeSegment } from "@kekonic/diagrams-routing";

export type EdgePathOptions = {
  route?: RouteMode;
  cornerRadius?: number;
};

const DEFAULT_CORNER_RADIUS = 22;
const METRO_CORNER_RADIUS = 36;

export function edgeStrokePath(
  segments: RenderedEdgeSegment[],
  options: EdgePathOptions = {},
): string {
  if (!segments.length) return "";
  const route = options.route ?? "metro";

  const cubics = cubicSegments(segments);
  if (cubics.length && cubics.length === strokeCount(segments)) {
    return cubicsToPath(cubics);
  }

  const linePoints = segmentsToPoints(segments);
  if (linePoints.length < 2) {
    if (cubics.length) return serializeMixed(segments);
    return "";
  }

  if (cubics.length) return serializeMixed(segments);

  if (route === "bezier" || route === "rounded" || route === "metro") {
    const organic = fitOrganicRoute(linePoints, [], {
      mode: route,
      cornerRadius:
        options.cornerRadius ?? (route === "metro" ? METRO_CORNER_RADIUS : DEFAULT_CORNER_RADIUS),
    });
    if (organic.length) return cubicsToPath(organic);
  }
  return polylinePath(linePoints);
}

function strokeCount(segments: RenderedEdgeSegment[]): number {
  return segments.filter((s) => s.type === "line" || s.type === "cubic").length;
}

function cubicSegments(segments: RenderedEdgeSegment[]): CubicBezier[] {
  return segments
    .filter((s): s is Extract<RenderedEdgeSegment, { type: "cubic" }> => s.type === "cubic")
    .map((s) => ({ from: s.from, c1: s.c1, c2: s.c2, to: s.to }));
}

function serializeMixed(segments: RenderedEdgeSegment[]): string {
  let d = "";
  let pen: Point | undefined;
  for (const seg of segments) {
    if (seg.type === "gap") {
      pen = undefined;
      continue;
    }
    if (seg.type === "jump") {
      if (!pen) d += `${d ? " " : ""}M ${seg.from.x} ${seg.from.y}`;
      const mx = (seg.from.x + seg.to.x) / 2;
      const my = (seg.from.y + seg.to.y) / 2;
      d += ` Q ${mx} ${my - seg.radius} ${seg.to.x} ${seg.to.y}`;
      pen = seg.to;
      continue;
    }
    if (seg.type === "cubic") {
      if (!pen || pen.x !== seg.from.x || pen.y !== seg.from.y) {
        d += `${d ? " " : ""}M ${seg.from.x} ${seg.from.y}`;
      }
      d += ` C ${seg.c1.x} ${seg.c1.y} ${seg.c2.x} ${seg.c2.y} ${seg.to.x} ${seg.to.y}`;
      pen = seg.to;
      continue;
    }
    if (!pen || pen.x !== seg.from.x || pen.y !== seg.from.y) {
      d += `${d ? " " : ""}M ${seg.from.x} ${seg.from.y}`;
    }
    d += ` L ${seg.to.x} ${seg.to.y}`;
    pen = seg.to;
  }
  return d.trim();
}

function segmentsToPoints(segments: RenderedEdgeSegment[]): Point[] {
  const points: Point[] = [];
  for (const seg of segments) {
    if (seg.type === "line") {
      if (!points.length) points.push(seg.from);
      points.push(seg.to);
    } else if (seg.type === "cubic") {
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
