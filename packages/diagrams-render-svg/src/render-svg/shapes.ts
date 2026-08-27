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
): string {
  const { x, y, width, height } = bounds;
  const rx = cardCornerRadius(shapeKind, height, roundedCorners);
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" ${shellAttrs(paint)}/>`;
}

export function renderDiamondShell(bounds: NodeBounds, paint: ShellPaint): string {
  return `<polygon points="${diamondPoints(bounds)}" ${shellAttrs(paint)}/>`;
}

export function renderHexagonShell(bounds: NodeBounds, paint: ShellPaint): string {
  return `<polygon points="${hexagonPoints(bounds)}" ${shellAttrs(paint)}/>`;
}

export function renderCylinderShell(bounds: NodeBounds, paint: ShellPaint): string {
  const { body, rim } = cylinderPaths(bounds);
  let out = `<path d="${body}" ${shellAttrs(paint)}/>`;
  out += `<path d="${rim}" class="flow-node-shell-rim" fill="none" stroke="${paint.stroke}" stroke-width="${NODE_STROKE}" stroke-linecap="round"${paint.dashAttr}/>`;
  return out;
}

/** Horizontal pipe — queue / message buffer silhouette. */
export function renderQueueShell(bounds: NodeBounds, paint: ShellPaint): string {
  const { body, rim } = queuePaths(bounds);
  let out = `<path d="${body}" ${shellAttrs(paint)}/>`;
  out += `<path d="${rim}" class="flow-node-shell-rim" fill="none" stroke="${paint.stroke}" stroke-width="${NODE_STROKE}" stroke-linecap="round"${paint.dashAttr}/>`;
  return out;
}

/** Stacked-log card — stream / topic / partition silhouette. */
export function renderStreamShell(bounds: NodeBounds, paint: ShellPaint): string {
  let out = `<path d="${streamShellPath(bounds)}" ${shellAttrs(paint)}/>`;
  for (const d of streamPartitionPaths(bounds)) {
    out += `<path d="${d}" class="flow-node-shell-partition" fill="none" stroke="${paint.stroke}" stroke-width="${NODE_STROKE}" stroke-linecap="round" opacity="0.4"${paint.dashAttr}/>`;
  }
  return out;
}

/** Actor glyph — body first, then head so the circle sits on the torso. */
export function renderPersonShell(bounds: NodeBounds, paint: ShellPaint): string {
  const { head, body } = personPaths(bounds);
  const attrs = shellAttrs(paint);
  let out = `<path d="${body}" ${attrs}/>`;
  out += `<path d="${head}" ${attrs}/>`;
  return out;
}

function shapeStyle(shapeKind: string, roundedCorners: boolean, height: number): ShapeStyle {
  if (shapeKind === "pill") return { strokeWidth: NODE_STROKE, cornerRadius: height / 2 };
  if (!roundedCorners) return { strokeWidth: NODE_STROKE, cornerRadius: 0 };
  if (shapeKind === "rectangle") return { strokeWidth: NODE_STROKE, cornerRadius: 6 };
  return { strokeWidth: NODE_STROKE, cornerRadius: 12 };
}

/** Path-based shells for geometries without dedicated SVG helpers. */
function renderPathShell(
  shapeKind: string,
  bounds: NodeBounds,
  paint: ShellPaint,
  roundedCorners: boolean,
): string {
  const geometry = resolveShapeGeometry(shapeKind);
  const style = shapeStyle(shapeKind, roundedCorners, bounds.height);
  const path = geometry.getPath(bounds, style);
  let out = `<path d="${path.d}" ${shellAttrs(paint)}/>`;
  for (const deco of path.decorations ?? []) {
    out += `<path d="${deco.d}" class="flow-node-shell-${deco.role}" fill="none" stroke="${paint.stroke}" stroke-width="${NODE_STROKE}" stroke-linecap="round"${paint.dashAttr}/>`;
  }
  return out;
}

export function renderNodeShell(
  shapeKind: string,
  bounds: NodeBounds,
  paint: ShellPaint,
  roundedCorners: boolean,
): string {
  const kind = normalizeShapeId(shapeKind);
  switch (kind) {
    case "diamond":
      return renderDiamondShell(bounds, paint);
    case "cylinder":
      return renderCylinderShell(bounds, paint);
    case "hexagon":
      return renderHexagonShell(bounds, paint);
    case "queue":
      return renderQueueShell(bounds, paint);
    case "stream":
      return renderStreamShell(bounds, paint);
    case "person":
      return renderPersonShell(bounds, paint);
    case "rectangle":
    case "pill":
    case "rounded":
      return renderCardShell(bounds, kind, paint, roundedCorners);
    case "table":
      return renderCardShell(bounds, "rectangle", paint, roundedCorners);
    case "circle":
    case "ellipse":
    case "parallelogram":
    case "trapezoid":
    case "triangle":
    case "document":
    case "folded-document":
    case "cloud":
    case "boundary":
      return renderPathShell(kind, bounds, paint, roundedCorners);
    default:
      return renderCardShell(bounds, kind, paint, roundedCorners);
  }
}
