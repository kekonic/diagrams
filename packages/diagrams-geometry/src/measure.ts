/**
 * Infer geometry size from desired content size using shape-specific safe regions.
 */

import type { Rect } from "./types.ts";
import type { ShapeGeometry } from "./shape-geometry.ts";

export type ContentSize = { width: number; height: number };

/**
 * Given a measured content size, find geometry bounds large enough that
 * getContentBounds() can contain it. Uses iterative refinement because
 * content insets are not always linear (cylinder caps, hex chamfers, …).
 */
export function geometrySizeForContent(
  geometry: ShapeGeometry,
  content: ContentSize,
  seed?: ContentSize,
): ContentSize {
  let width = Math.max(content.width, seed?.width ?? content.width, geometry.minSize?.width ?? 0);
  let height = Math.max(
    content.height,
    seed?.height ?? content.height,
    geometry.minSize?.height ?? 0,
  );

  for (let i = 0; i < 6; i++) {
    const bounds: Rect = { x: 0, y: 0, width, height };
    const box = geometry.getContentBounds(bounds);
    const needW = box.width > 0 ? content.width / box.width : 1;
    const needH = box.height > 0 ? content.height / box.height : 1;
    const nextW = Math.max(width * needW, geometry.minSize?.width ?? 0);
    const nextH = Math.max(height * needH, geometry.minSize?.height ?? 0);
    if (Math.abs(nextW - width) < 0.5 && Math.abs(nextH - height) < 0.5) {
      width = nextW;
      height = nextH;
      break;
    }
    width = nextW;
    height = nextH;
  }

  return { width, height };
}

/** Relative content box (origin at geometry top-left) for MeasuredNode.contentBox. */
export function relativeContentBox(geometry: ShapeGeometry, width: number, height: number): Rect {
  return geometry.getContentBounds({ x: 0, y: 0, width, height });
}
