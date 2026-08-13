import type { Point, Rect } from "../types.ts";
import { DEFAULT_STROKE_WIDTH } from "../types.ts";
import {
  type ShapeGeometry,
  defaultLayoutFootprint,
  defaultPortNormal,
  defaultSidePortPosition,
  defaultVisualBounds,
  projectSidePortOntoPolygon,
} from "../shape-geometry.ts";
import { intersectRayPolygon, intersectRayRect, pointInPolygon, rectPolygon } from "../math.ts";

type PersonLayout = {
  cx: number;
  headR: number;
  headCy: number;
  bodyTop: number;
  bodyBottom: number;
  bodyHalfW: number;
  bodyRx: number;
  /** Interior of the torso where labels / icons sit. */
  content: Rect;
};

/** Head sits above the torso; torso uses the full node width and holds content. */
const HEAD_GAP = 0.18; // neck gap as fraction of headR
const BODY_PAD_X = 12;
const BODY_PAD_Y = 10;

function personLayout(bounds: Rect, stroke = DEFAULT_STROKE_WIDTH): PersonLayout {
  const { x, y, width, height } = bounds;
  const inset = stroke + 1;
  // Body spans nearly the full AABB width so long labels widen the torso.
  const bodyHalfW = Math.max(18, width / 2 - inset);
  const headR = Math.max(10, Math.min(22, bodyHalfW * 0.38));
  const headCy = y + headR + Math.max(3, inset);
  const bodyTop = headCy + headR + Math.max(2, headR * HEAD_GAP);
  const bodyBottom = y + height - inset;
  const bodyH = Math.max(bodyBottom - bodyTop, headR * 2.2);
  const bodyRx = Math.min(bodyHalfW, bodyH * 0.42);
  const cx = x + width / 2;
  const content = {
    x: cx - bodyHalfW + BODY_PAD_X,
    y: bodyTop + BODY_PAD_Y,
    width: Math.max(0, bodyHalfW * 2 - BODY_PAD_X * 2),
    height: Math.max(0, bodyBottom - bodyTop - BODY_PAD_Y * 2),
  };
  return {
    cx,
    headR,
    headCy,
    bodyTop,
    bodyBottom,
    bodyHalfW,
    bodyRx,
    content,
  };
}

/** Port anchors: head (N), torso sides (E/W), feet (S). */
export function personPortAnchors(
  bounds: Rect,
): Record<"north" | "east" | "south" | "west", Point> {
  const { cx, headR, headCy, bodyTop, bodyBottom, bodyHalfW, bodyRx } = personLayout(bounds);
  const ry = Math.min(bodyRx, (bodyBottom - bodyTop) / 2);
  const shoulderY = bodyTop + ry + Math.max(2, (bodyBottom - bodyTop - 2 * ry) * 0.12);
  return {
    north: { x: cx, y: headCy - headR },
    east: { x: cx + bodyHalfW, y: shoulderY },
    west: { x: cx - bodyHalfW, y: shoulderY },
    south: { x: cx, y: bodyBottom },
  };
}

/** Closed silhouette for rays / multi-port projection (head arc + rounded torso). */
export function personSilhouettePolygon(bounds: Rect, headSamples = 12): Point[] {
  const { cx, headR, headCy, bodyTop, bodyBottom, bodyHalfW, bodyRx } = personLayout(bounds);
  const pts: Point[] = [];
  for (let i = 0; i <= headSamples; i++) {
    const t = Math.PI - (i / headSamples) * Math.PI;
    pts.push({ x: cx + headR * Math.cos(t), y: headCy - headR * Math.sin(t) });
  }
  const right = cx + bodyHalfW;
  const left = cx - bodyHalfW;
  const ry = Math.min(bodyRx, (bodyBottom - bodyTop) / 2);
  pts.push({ x: right, y: bodyTop + ry });
  pts.push({ x: right, y: bodyBottom - ry });
  pts.push({ x: cx + bodyHalfW - ry * 0.15, y: bodyBottom });
  pts.push({ x: cx, y: bodyBottom });
  pts.push({ x: cx - bodyHalfW + ry * 0.15, y: bodyBottom });
  pts.push({ x: left, y: bodyBottom - ry });
  pts.push({ x: left, y: bodyTop + ry });
  return pts;
}

/**
 * Person / actor — C4-style head + rounded torso.
 * The torso is the content box: it grows with label/subtitle width.
 */
export function personPaths(bounds: Rect): { head: string; body: string } {
  const { cx, headR, headCy, bodyTop, bodyBottom, bodyHalfW, bodyRx } = personLayout(bounds);
  const head = `M ${cx} ${headCy} m ${-headR} 0 a ${headR} ${headR} 0 1 0 ${headR * 2} 0 a ${headR} ${headR} 0 1 0 ${-headR * 2} 0`;
  const left = cx - bodyHalfW;
  const right = cx + bodyHalfW;
  const ry = Math.min(bodyRx, (bodyBottom - bodyTop) / 2);
  const body = [
    `M ${left + ry} ${bodyTop}`,
    `H ${right - ry}`,
    `A ${ry} ${ry} 0 0 1 ${right} ${bodyTop + ry}`,
    `V ${bodyBottom - ry}`,
    `A ${ry} ${ry} 0 0 1 ${right - ry} ${bodyBottom}`,
    `H ${left + ry}`,
    `A ${ry} ${ry} 0 0 1 ${left} ${bodyBottom - ry}`,
    `V ${bodyTop + ry}`,
    `A ${ry} ${ry} 0 0 1 ${left + ry} ${bodyTop}`,
    `Z`,
  ].join(" ");
  return { head, body };
}

/** Extra height above the torso content for head + neck (used by measure). */
export function personHeadStackHeight(bodyWidth: number): number {
  const bodyHalfW = Math.max(18, bodyWidth / 2 - 2);
  const headR = Math.max(10, Math.min(22, bodyHalfW * 0.38));
  return headR * 2 + Math.max(2, headR * HEAD_GAP) + 6;
}

export const personGeometry: ShapeGeometry = {
  id: "person",
  defaultSize: { width: 120, height: 140 },
  minSize: { width: 72, height: 96 },
  defaultPadding: { top: 8, right: 12, bottom: 10, left: 12 },
  contentPolicy: {
    align: "center",
    maxLabelLines: 2,
    preferExternalLabel: false,
    iconPlacement: "above",
  },
  clearSpaceBoost: 4,

  getPath(bounds) {
    const { head, body } = personPaths(bounds);
    return {
      d: `${head} ${body}`,
      decorations: [
        { d: head, role: "head" },
        { d: body, role: "body" },
      ],
    };
  },

  getContentBounds(bounds, style = {}) {
    const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    return personLayout(bounds, stroke).content;
  },

  getVisualBounds(bounds, style) {
    return defaultVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(personGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds) {
    if (port.kind === "side" && (port.count ?? 1) <= 1) {
      const anchors = personPortAnchors(bounds);
      const side = port.side;
      if (side === "north" || side === "east" || side === "south" || side === "west") {
        return anchors[side];
      }
    }
    return projectSidePortOntoPolygon(
      port,
      bounds,
      personSilhouettePolygon(bounds),
      intersectRayPolygon,
    );
  },

  getPortNormal(port, bounds) {
    return defaultPortNormal(port, bounds);
  },

  intersectRay(bounds, origin, direction) {
    return intersectRayPolygon(personSilhouettePolygon(bounds), origin, direction);
  },

  containsPoint(bounds, point) {
    return pointInPolygon(point, personSilhouettePolygon(bounds));
  },
};

export const compartmentedRectangleGeometry: ShapeGeometry = {
  id: "table",
  defaultSize: { width: 240, height: 160 },
  minSize: { width: 140, height: 72 },
  defaultPadding: { top: 8, right: 12, bottom: 8, left: 12 },
  contentPolicy: { align: "start", maxLabelLines: 1, iconPlacement: "none" },

  getPath(bounds) {
    const { x, y, width, height } = bounds;
    return {
      d: `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`,
      polygon: rectPolygon(bounds),
    };
  },

  getContentBounds(bounds, style = {}) {
    const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
    return {
      x: bounds.x + stroke + 8,
      y: bounds.y + stroke + 8,
      width: Math.max(0, bounds.width - (stroke + 8) * 2),
      height: Math.max(0, bounds.height - (stroke + 8) * 2),
    };
  },

  getVisualBounds(bounds, style) {
    return defaultVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(compartmentedRectangleGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds) {
    return defaultSidePortPosition(port, bounds);
  },

  getPortNormal(port, bounds) {
    return defaultPortNormal(port, bounds);
  },

  intersectRay(bounds, origin, direction) {
    return intersectRayRect(bounds, origin, direction);
  },

  containsPoint(bounds, point) {
    return pointInPolygon(point, rectPolygon(bounds));
  },
};

export const boundaryGeometry: ShapeGeometry = {
  id: "boundary",
  defaultSize: { width: 320, height: 220 },
  minSize: { width: 120, height: 80 },
  defaultPadding: { top: 28, right: 20, bottom: 20, left: 20 },
  contentPolicy: { align: "start", maxLabelLines: 1, iconPlacement: "none" },

  getPath(bounds) {
    return compartmentedRectangleGeometry.getPath(bounds);
  },

  getContentBounds(bounds, style) {
    return compartmentedRectangleGeometry.getContentBounds(bounds, style);
  },

  getVisualBounds(bounds, style) {
    return compartmentedRectangleGeometry.getVisualBounds(bounds, style);
  },

  getLayoutFootprint(bounds, context, style) {
    return defaultLayoutFootprint(boundaryGeometry, bounds, context, style);
  },

  getPortPosition(port, bounds, style) {
    return compartmentedRectangleGeometry.getPortPosition(port, bounds, style);
  },

  getPortNormal(port, bounds, style) {
    return compartmentedRectangleGeometry.getPortNormal(port, bounds, style);
  },

  intersectRay(bounds, origin, direction, style) {
    return compartmentedRectangleGeometry.intersectRay(bounds, origin, direction, style);
  },

  containsPoint(bounds, point, style) {
    return compartmentedRectangleGeometry.containsPoint(bounds, point, style);
  },
};
