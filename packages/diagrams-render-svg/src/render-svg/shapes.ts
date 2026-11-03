/**
 * Per-kind node shell geometry.
 * Shape math lives in @kekonic/diagrams-geometry; this module emits SVG markup.
 * Shapes share one stroke weight and meet ports on the bounding-box mid-sides
 * where ELK attaches edges.
 */

import {
  DEFAULT_STROKE_WIDTH,
  cylinderPaths,
  cylinderRadii,
  diamondPointsString,
  hexagonInset,
  hexagonPointsString,
  normalizeShapeId,
  personPaths,
  queuePaths,
  queueRadii,
  resolveShapeGeometry,
  streamPartitionPaths,
  streamShellPath,
  type ShapeStyle,
} from "@kekonic/diagrams-geometry";
import { polygonPointsPath, roundedRectPath, sketchShapePath } from "./sketch-stroke.ts";

export { hexagonInset, cylinderPaths, cylinderRadii, queuePaths, queueRadii };

export const NODE_STROKE = DEFAULT_STROKE_WIDTH;

export type NodeBounds = { x: number; y: number; width: number; height: number };

export type ShellPaint = {
  fill: string;
  stroke: string;
  dashAttr: string;
  filterAttr: string;
};

function shellAttrs(paint: ShellPaint, extra = ""): string {
  return `class="flow-node-shell" fill="${paint.fill}" stroke="${paint.stroke}" stroke-width="${NODE_STROKE}" stroke-linejoin="round" stroke-linecap="round"${paint.dashAttr}${paint.filterAttr}${extra}`;
}

/** Same contour for fill and stroke. Missing key keeps the authored path. */
function sketched(d: string, sketchKey?: string, part?: string): string {
  if (!sketchKey) return d;
  return sketchShapePath(d, part ? `${sketchKey}:${part}` : sketchKey);
}

/** Pill is shape-defining — always capsule, independent of roundedCorners. */
export function cardCornerRadius(
  shapeKind: string,
  height: number,
  roundedCorners: boolean,
): number {
  if (shapeKind === "pill") return height / 2;
  if (!roundedCorners) return 0;
  if (shapeKind === "rectangle") return 6;
  return 12;
}

export function hexagonPoints(bounds: NodeBounds): string {
  return hexagonPointsString(bounds);
}

/** Diamond tips sit on bounding-box mid-sides so LR/TD ports land on vertices. */
export function diamondPoints(bounds: NodeBounds): string {
  return diamondPointsString(bounds);
}

export function renderCardShell(
  bounds: NodeBounds,
  shapeKind: string,
  paint: ShellPaint,
  roundedCorners: boolean,
  sketchKey?: string,
): string {
  const { x, y, width, height } = bounds;
  const rx = cardCornerRadius(shapeKind, height, roundedCorners);
  if (sketchKey) {
    const d = sketched(roundedRectPath(bounds, rx), sketchKey);
    return `<path d="${d}" ${shellAttrs(paint)}/>`;
  }
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ${shellAttrs(paint)}/>`;
}

export function renderDiamondShell(
  bounds: NodeBounds,
  paint: ShellPaint,
  sketchKey?: string,
): string {
  if (sketchKey) {
    const d = sketched(polygonPointsPath(diamondPoints(bounds)), sketchKey);
    return `<path d="${d}" ${shellAttrs(paint)}/>`;
  }
  return `<polygon points="${diamondPoints(bounds)}" ${shellAttrs(paint)}/>`;
}

export function renderHexagonShell(
  bounds: NodeBounds,
  paint: ShellPaint,
  sketchKey?: string,
): string {
  if (sketchKey) {
    const d = sketched(polygonPointsPath(hexagonPoints(bounds)), sketchKey);
    return `<path d="${d}" ${shellAttrs(paint)}/>`;
  }
  return `<polygon points="${hexagonPoints(bounds)}" ${shellAttrs(paint)}/>`;
}

export function renderCylinderShell(
  bounds: NodeBounds,
  paint: ShellPaint,
  sketchKey?: string,
): string {
  const { body, rim } = cylinderPaths(bounds);
  let out = `<path d="${sketched(body, sketchKey)}" ${shellAttrs(paint)}/>`;
  out += `<path d="${sketched(rim, sketchKey, "rim")}" class="flow-node-shell-rim" fill="none" stroke="${paint.stroke}" stroke-width="${NODE_STROKE}" stroke-linecap="round"${paint.dashAttr}/>`;
  return out;
}

/** Horizontal pipe — queue / message buffer silhouette. */
export function renderQueueShell(
  bounds: NodeBounds,
  paint: ShellPaint,
  sketchKey?: string,
): string {
  const { body, rim } = queuePaths(bounds);
  let out = `<path d="${sketched(body, sketchKey)}" ${shellAttrs(paint)}/>`;
  out += `<path d="${sketched(rim, sketchKey, "rim")}" class="flow-node-shell-rim" fill="none" stroke="${paint.stroke}" stroke-width="${NODE_STROKE}" stroke-linecap="round"${paint.dashAttr}/>`;
  return out;
}

/** Stacked-log card — stream / topic / partition silhouette. */
export function renderStreamShell(
  bounds: NodeBounds,
  paint: ShellPaint,
  sketchKey?: string,
): string {
  let out = `<path d="${sketched(streamShellPath(bounds), sketchKey)}" ${shellAttrs(paint)}/>`;
  for (const [index, d] of streamPartitionPaths(bounds).entries()) {
    out += `<path d="${sketched(d, sketchKey, `partition:${index}`)}" class="flow-node-shell-partition" fill="none" stroke="${paint.stroke}" stroke-width="${NODE_STROKE}" stroke-linecap="round" opacity="0.4"${paint.dashAttr}/>`;
  }
  return out;
}

/** Actor glyph — body first, then head so the circle sits on the torso. */
export function renderPersonShell(
  bounds: NodeBounds,
  paint: ShellPaint,
  sketchKey?: string,
): string {
  const { head, body } = personPaths(bounds);
  const attrs = shellAttrs(paint);
  let out = `<path d="${sketched(body, sketchKey, "body")}" ${attrs}/>`;
  out += `<path d="${sketched(head, sketchKey, "head")}" ${attrs}/>`;
  return out;
}

function shapeStyle(shapeKind: string, roundedCorners: boolean, height: number): ShapeStyle {
  if (shapeKind === "pill") return { strokeWidth: NODE_STROKE, cornerRadius: height / 2 };
  if (!roundedCorners) return { strokeWidth: NODE_STROKE, cornerRadius: 0 };
  if (shapeKind === "rectangle") return { strokeWidth: NODE_STROKE, cornerRadius: 6 };
  return { strokeWidth: NODE_STROKE, cornerRadius: 12 };
}

/** Cup is stroked only. Theme fill would otherwise close the arc into a solid D. */
function renderSocketShell(bounds: NodeBounds, paint: ShellPaint, sketchKey?: string): string {
  const geometry = resolveShapeGeometry("socket");
  const path = geometry.getPath(bounds, { strokeWidth: NODE_STROKE });
  const d = sketched(path.d, sketchKey);
  return `<path d="${d}" class="flow-node-shell flow-node-shell-socket" fill="none" stroke="${paint.stroke}" stroke-width="${NODE_STROKE}" stroke-linejoin="round" stroke-linecap="round"${paint.dashAttr}${paint.filterAttr}/>`;
}

/** Path-based shells for geometries without dedicated SVG helpers. */
function renderPathShell(
  shapeKind: string,
  bounds: NodeBounds,
  paint: ShellPaint,
  roundedCorners: boolean,
  sketchKey?: string,
): string {
  const geometry = resolveShapeGeometry(shapeKind);
  const style = shapeStyle(shapeKind, roundedCorners, bounds.height);
  const path = geometry.getPath(bounds, style);
  let out = `<path d="${sketched(path.d, sketchKey)}" ${shellAttrs(paint)}/>`;
  for (const [index, deco] of (path.decorations ?? []).entries()) {
    out += `<path d="${sketched(deco.d, sketchKey, `${deco.role}:${index}`)}" class="flow-node-shell-${deco.role}" fill="none" stroke="${paint.stroke}" stroke-width="${NODE_STROKE}" stroke-linecap="round"${paint.dashAttr}/>`;
  }
  return out;
}

export function renderNodeShell(
  shapeKind: string,
  bounds: NodeBounds,
  paint: ShellPaint,
  roundedCorners: boolean,
  sketchKey?: string,
): string {
  const kind = normalizeShapeId(shapeKind);
  switch (kind) {
    case "diamond":
      return renderDiamondShell(bounds, paint, sketchKey);
    case "cylinder":
      return renderCylinderShell(bounds, paint, sketchKey);
    case "hexagon":
      return renderHexagonShell(bounds, paint, sketchKey);
    case "queue":
      return renderQueueShell(bounds, paint, sketchKey);
    case "stream":
      return renderStreamShell(bounds, paint, sketchKey);
    case "person":
      return renderPersonShell(bounds, paint, sketchKey);
    case "rectangle":
    case "pill":
    case "rounded":
      return renderCardShell(bounds, kind, paint, roundedCorners, sketchKey);
    case "table":
      return renderCardShell(bounds, "rectangle", paint, roundedCorners, sketchKey);
    case "ball":
      return renderPathShell("ball", bounds, paint, roundedCorners, sketchKey);
    case "socket":
      return renderSocketShell(bounds, paint, sketchKey);
    case "circle":
    case "ellipse":
    case "parallelogram":
    case "trapezoid":
    case "triangle":
    case "document":
    case "folded-document":
    case "cloud":
    case "boundary":
      return renderPathShell(kind, bounds, paint, roundedCorners, sketchKey);
    default:
      return renderCardShell(bounds, kind, paint, roundedCorners, sketchKey);
  }
}
