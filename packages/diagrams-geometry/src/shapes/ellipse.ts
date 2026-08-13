import type { Rect } from "../types.ts";
import { DEFAULT_STROKE_WIDTH } from "../types.ts";
import {
  type ShapeGeometry,
  defaultLayoutFootprint,
  defaultPortNormal,
  defaultVisualBounds,
  projectSidePortOntoOutline,
} from "../shape-geometry.ts";
import { centeredContentRect, intersectRayEllipse, pointInEllipse } from "../math.ts";

function createEllipseGeometry(
  id: string,
  contentRatio: { w: number; h: number },
  opts: { preferExternalLabel?: boolean; defaultSize?: { width: number; height: number } } = {},
): ShapeGeometry {
  const geometry: ShapeGeometry = {
    id,
    defaultSize: opts.defaultSize ?? { width: 120, height: 80 },
    minSize: { width: 32, height: 32 },
    defaultPadding: { top: 12, right: 16, bottom: 12, left: 16 },
    contentPolicy: {
      align: "center",
      maxLabelLines: id === "circle" ? 1 : 2,
      preferExternalLabel: opts.preferExternalLabel ?? id === "circle",
      iconPlacement: "centered",
    },

    getPath(bounds) {
      const cx = bounds.x + bounds.width / 2;
      const cy = bounds.y + bounds.height / 2;
      const rx = bounds.width / 2;
      const ry = bounds.height / 2;
      // Two-arc ellipse path.
      const d = [
        `M ${cx - rx} ${cy}`,
        `A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy}`,
        `A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`,
        `Z`,
      ].join(" ");
      return { d };
    },

    getContentBounds(bounds, style = {}) {
      const stroke = style.strokeWidth ?? DEFAULT_STROKE_WIDTH;
      const content = centeredContentRect(bounds, contentRatio.w, contentRatio.h);
      return {
        x: content.x + stroke,
        y: content.y + stroke,
        width: Math.max(0, content.width - stroke * 2),
        height: Math.max(0, content.height - stroke * 2),
      };
    },

    getVisualBounds(bounds, style) {
      return defaultVisualBounds(bounds, style);
    },

    getLayoutFootprint(bounds, context, style) {
      return defaultLayoutFootprint(geometry, bounds, context, style);
    },

    getPortPosition(port, bounds) {
      if (port.kind === "radial") {
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        const rad = (port.angleDeg * Math.PI) / 180;
        return {
          x: cx + Math.cos(rad) * (bounds.width / 2),
          y: cy + Math.sin(rad) * (bounds.height / 2),
        };
      }
      // Cardinal / fan ports: project AABB slots onto the ellipse (not outside fill).
      return projectSidePortOntoOutline(port, bounds, (direction) =>
        intersectRayEllipse(
          bounds,
          {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
          },
          direction,
        ),
      );
    },

    getPortNormal(port, bounds) {
      if (port.kind === "radial") {
        const rad = (port.angleDeg * Math.PI) / 180;
        return { x: Math.cos(rad), y: Math.sin(rad) };
      }
      return defaultPortNormal(port, bounds);
    },

    intersectRay(bounds, origin, direction) {
      return intersectRayEllipse(bounds, origin, direction);
    },

    containsPoint(bounds, point) {
      return pointInEllipse(point, bounds);
    },
  };
  return geometry;
}

export const ellipseGeometry = createEllipseGeometry("ellipse", { w: 0.7, h: 0.7 });
export const circleGeometry = createEllipseGeometry(
  "circle",
  { w: 0.55, h: 0.55 },
  { preferExternalLabel: true, defaultSize: { width: 40, height: 40 } },
);

/** Ensure circle stays square when asked via helper. */
export function squareBoundsFrom(bounds: Rect): Rect {
  const s = Math.min(bounds.width, bounds.height);
  return {
    x: bounds.x + (bounds.width - s) / 2,
    y: bounds.y + (bounds.height - s) / 2,
    width: s,
    height: s,
  };
}
