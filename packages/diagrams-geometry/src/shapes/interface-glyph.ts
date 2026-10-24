import type { Point, Rect } from "../types.ts";
import {
  type ShapeGeometry,
  defaultLayoutFootprint,
  defaultPortNormal,
  defaultVisualBounds,
  projectSidePortOntoOutline,
} from "../shape-geometry.ts";
import {
  intersectRayEllipse,
  intersectRayPolygon,
  pointInEllipse,
  pointInPolygon,
} from "../math.ts";

/** Provided/required interface glyph at 1x. Captions sit under this band. */
export const INTERFACE_GLYPH_SIZE = 28;
/** Gap between the glyph and the caption band. */
export const INTERFACE_GLYPH_LABEL_GAP = 6;

/**
 * Top glyph extent. Stays the nominal size when a caption makes the node taller,
 * and shrinks only when the node itself is smaller than the glyph.
 */
export function interfaceGlyphSize(bounds: Rect): number {
  return Math.min(INTERFACE_GLYPH_SIZE, bounds.width, bounds.height);
}

function glyphOriginY(bounds: Rect, size: number): number {
  // Center the glyph so bounding-box mid-side ports meet the equator.
  // The caption band hangs below; an equal pad above keeps that equator centered.
  return bounds.y + (bounds.height - size) / 2;
}

export function ballGlyphBox(bounds: Rect): Rect {
  const size = interfaceGlyphSize(bounds);
  return {
    x: bounds.x + (bounds.width - size) / 2,
    y: glyphOriginY(bounds, size),
    width: size,
    height: size,
  };
}

/** East-opening cup: diameter on the left, arc reaching the right. Half as wide as the ball. */
export function socketGlyphBox(bounds: Rect): Rect {
  const size = interfaceGlyphSize(bounds);
  const width = size / 2;
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: glyphOriginY(bounds, size),
    width,
    height: size,
  };
}

function labelBand(bounds: Rect): Rect {
  const glyph = interfaceGlyphSize(bounds);
  if (bounds.height <= glyph + 0.5) {
    return { x: bounds.x, y: bounds.y + bounds.height, width: bounds.width, height: 0 };
  }
  const y = glyphOriginY(bounds, glyph) + glyph + INTERFACE_GLYPH_LABEL_GAP;
  return {
    x: bounds.x,
    y,
    width: bounds.width,
    height: Math.max(0, bounds.y + bounds.height - y),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function fmt(value: number): string {
  return String(round(value));
}

function ballPath(box: Rect): string {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width / 2;
  return `M ${fmt(cx - r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)} Z`;
}

const CUBIC_KAPPA = 0.5522847498;

/**
 * Stroke-only cup from north through east to south. The diameter is not drawn.
 * Cubics, not an SVG arc: a chord equal to the diameter is dropped by some renderers.
 */
export function socketArcPath(box: Rect): string {
  const radius = box.width;
  const cx = box.x;
  const cy = box.y + box.height / 2;
  const k = CUBIC_KAPPA * radius;
  const northY = box.y;
  const southY = box.y + box.height;
  const apexX = cx + radius;
  return [
    `M ${fmt(cx)} ${fmt(northY)}`,
    `C ${fmt(cx + k)} ${fmt(northY)} ${fmt(apexX)} ${fmt(cy - k)} ${fmt(apexX)} ${fmt(cy)}`,
    `C ${fmt(apexX)} ${fmt(cy + k)} ${fmt(cx + k)} ${fmt(southY)} ${fmt(cx)} ${fmt(southY)}`,
  ].join(" ");
}

function socketOutline(box: Rect): Point[] {
  const radius = box.width;
  const cx = box.x;
  const cy = box.y + box.height / 2;
  const steps = 16;
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / steps;
    points.push({ x: cx + Math.cos(t) * radius, y: cy + Math.sin(t) * radius });
  }
  return points;
}

function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

function createGlyphGeometry(
  id: "ball" | "socket",
  glyphOf: (bounds: Rect) => Rect,
  outlineHit: (bounds: Rect, origin: Point, direction: { x: number; y: number }) => Point | null,
  containsGlyph: (bounds: Rect, point: Point) => boolean,
  pathOf: (bounds: Rect) => string,
): ShapeGeometry {
  const geometry: ShapeGeometry = {
    id,
    defaultSize: { width: INTERFACE_GLYPH_SIZE, height: INTERFACE_GLYPH_SIZE },
    minSize: { width: 16, height: 16 },
    contentPolicy: {
      align: "center",
      maxLabelLines: 3,
      preferExternalLabel: true,
    },

    getPath(bounds) {
      return { d: pathOf(bounds) };
    },

    getContentBounds(bounds) {
      return labelBand(bounds);
    },

    getVisualBounds(bounds, style) {
      return defaultVisualBounds(bounds, style);
    },

    getLayoutFootprint(bounds, context, style) {
      return defaultLayoutFootprint(geometry, bounds, context, style);
    },

    getPortPosition(port, bounds) {
      const glyph = glyphOf(bounds);
      return projectSidePortOntoOutline(port, glyph, (direction) => {
        const origin = {
          x: glyph.x + glyph.width / 2,
          y: glyph.y + glyph.height / 2,
        };
        return outlineHit(bounds, origin, direction);
      });
    },

    getPortNormal(port, bounds) {
      return defaultPortNormal(port, bounds);
    },

    intersectRay(bounds, origin, direction) {
      return outlineHit(bounds, origin, direction);
    },

    containsPoint(bounds, point) {
      if (containsGlyph(bounds, point)) return true;
      const band = labelBand(bounds);
      return band.height > 0 && pointInRect(point, band);
    },
  };
  return geometry;
}

export const ballGeometry = createGlyphGeometry(
  "ball",
  ballGlyphBox,
  (bounds, origin, direction) => intersectRayEllipse(ballGlyphBox(bounds), origin, direction),
  (bounds, point) => pointInEllipse(point, ballGlyphBox(bounds)),
  (bounds) => ballPath(ballGlyphBox(bounds)),
);

export const socketGeometry = createGlyphGeometry(
  "socket",
  socketGlyphBox,
  (bounds, origin, direction) =>
    intersectRayPolygon(socketOutline(socketGlyphBox(bounds)), origin, direction),
  (bounds, point) => pointInPolygon(point, socketOutline(socketGlyphBox(bounds))),
  (bounds) => socketArcPath(socketGlyphBox(bounds)),
);
