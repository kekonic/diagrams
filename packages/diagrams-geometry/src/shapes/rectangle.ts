import type { Point, Rect, ShapeStyle } from "../types.ts";
import { DEFAULT_STROKE_WIDTH, insetRect } from "../types.ts";
import {
  type ShapeGeometry,
  type ShapeGeometryBaseOptions,
  defaultLayoutFootprint,
  defaultPortNormal,
  defaultSidePortPosition,
  defaultVisualBounds,
  projectSidePortOntoPolygon,
} from "../shape-geometry.ts";
import {
  intersectRayPolygon,
  intersectRayRect,
  pointInPolygon,
  polygonToPath,
  rectPolygon,
} from "../math.ts";

export type RectangleOptions = ShapeGeometryBaseOptions & {
  /** Fixed corner radius; capped at half min dimension. */
  cornerRadius?: number;
  /** When true, radius = height/2 (capsule). */
  pill?: boolean;
};

function resolveRadius(
  bounds: Rect,
  style: ShapeStyle | undefined,
  opts: RectangleOptions,
): number {
  if (opts.pill) return bounds.height / 2;
  const configured = style?.cornerRadius ?? opts.cornerRadius ?? 0;
  return Math.min(configured, bounds.width / 2, bounds.height / 2);
}

/** Sampled rounded-rect / capsule outline for ports, rays, and hit tests. */
export function roundedRectPolygon(bounds: Rect, r: number, arcSamples = 6): Point[] {
  if (r <= 0) return rectPolygon(bounds);
  const { x, y, width, height } = bounds;
  const radius = Math.min(r, width / 2, height / 2);
  const pts: Point[] = [];
  const arc = (cx: number, cy: number, start: number, end: number) => {
    for (let i = 0; i <= arcSamples; i++) {
      const t = start + ((end - start) * i) / arcSamples;
      pts.push({ x: cx + radius * Math.cos(t), y: cy + radius * Math.sin(t) });
    }
  };
  // Clockwise from top edge after NE corner origin… start NW corner arc.
  arc(x + radius, y + radius, -Math.PI, -Math.PI / 2); // NW
  arc(x + width - radius, y + radius, -Math.PI / 2, 0); // NE
  arc(x + width - radius, y + height - radius, 0, Math.PI / 2); // SE
  arc(x + radius, y + height - radius, Math.PI / 2, Math.PI); // SW
  return pts;
}

export function createRectangleGeometry(
  opts: RectangleOptions = { id: "rectangle" },
): ShapeGeometry {
  const id = opts.id;
  const geometry: ShapeGeometry = {
    id,
    defaultSize: opts.defaultSize ?? { width: 160, height: 72 },
    minSize: opts.minSize ?? { width: 48, height: 32 },
    defaultPadding: opts.defaultPadding ?? { top: 16, right: 18, bottom: 16, left: 18 },
    contentPolicy: opts.contentPolicy ?? {
      align: "start",
      maxLabelLines: 2,
      iconPlacement: "leading",
    },

    getPath(bounds, style = {}) {
      const r = resolveRadius(bounds, style, opts);
      const { x, y, width, height } = bounds;
      if (r <= 0) {
        const polygon = rectPolygon(bounds);
        return { d: polygonToPath(polygon), polygon };
      }
      const d = [
        `M ${x + r} ${y}`,
        `L ${x + width - r} ${y}`,
        `A ${r} ${r} 0 0 1 ${x + width} ${y + r}`,
        `L ${x + width} ${y + height - r}`,
        `A ${r} ${r} 0 0 1 ${x + width - r} ${y + height}`,
        `L ${x + r} ${y + height}`,
        `A ${r} ${r} 0 0 1 ${x} ${y + height - r}`,
        `L ${x} ${y + r}`,
        `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
        `Z`,
      ].join(" ");
      return { d, polygon: roundedRectPolygon(bounds, r) };
    },

    getContentBounds(bounds, style = {}) {
      const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
      const r = resolveRadius(bounds, style, opts);
      const pad = Math.max(stroke, r > 0 ? r * 0.35 : 0) + 2;
      return insetRect(bounds, pad);
    },

    getVisualBounds(bounds, style) {
      return defaultVisualBounds(bounds, style);
    },

    getLayoutFootprint(bounds, context, style) {
      return defaultLayoutFootprint(geometry, bounds, context, style);
    },

    getPortPosition(port, bounds, style = {}) {
      const r = resolveRadius(bounds, style, opts);
      if (r <= 0) return defaultSidePortPosition(port, bounds);
      // Project AABB slots onto the rounded/capsule outline (keeps pill E/W fans apart).
      return projectSidePortOntoPolygon(
        port,
        bounds,
        roundedRectPolygon(bounds, r),
        intersectRayPolygon,
      );
    },

    getPortNormal(port, bounds) {
      return defaultPortNormal(port, bounds);
    },

    intersectRay(bounds, origin, direction, style = {}) {
      const r = resolveRadius(bounds, style, opts);
      if (r <= 0) return intersectRayRect(bounds, origin, direction);
      return intersectRayPolygon(roundedRectPolygon(bounds, r), origin, direction);
    },

    containsPoint(bounds, point, style = {}) {
      const r = resolveRadius(bounds, style, opts);
      if (r <= 0) return pointInPolygon(point, rectPolygon(bounds));
      return pointInPolygon(point, roundedRectPolygon(bounds, r));
    },
  };
  return geometry;
}

export const rectangleGeometry = createRectangleGeometry({ id: "rectangle" });
export const roundedRectangleGeometry = createRectangleGeometry({
  id: "rounded",
  // Match SVG card default when style is omitted (layout FIXED_POS / snap).
  cornerRadius: 12,
  contentPolicy: { align: "start", maxLabelLines: 2, iconPlacement: "leading" },
});
export const pillGeometry = createRectangleGeometry({
  id: "pill",
  pill: true,
  defaultSize: { width: 120, height: 40 },
  contentPolicy: { align: "center", maxLabelLines: 1, iconPlacement: "leading" },
});
