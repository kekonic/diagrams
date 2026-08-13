import type { Rect } from "@kekonic/diagrams-core";
import { rectsOverlap } from "@kekonic/diagrams-core";
import type { EdgeLabelPlacement } from "@kekonic/diagrams-routing";

const LABEL_MARGIN = 4;

/** Nudge edge labels so they stay inside diagram content bounds and off keep-out rects. */
export function clampEdgeLabels(
  labels: EdgeLabelPlacement[],
  contentBounds: Rect,
  enabled: boolean,
  keepOutRects: Rect[] = [],
): EdgeLabelPlacement[] {
  if (!enabled || !labels.length) return labels;

  const minX = contentBounds.x + LABEL_MARGIN;
  const minY = contentBounds.y + LABEL_MARGIN;
  const maxX = contentBounds.x + contentBounds.width - LABEL_MARGIN;
  const maxY = contentBounds.y + contentBounds.height - LABEL_MARGIN;

  return labels.map((label) => {
    let { x, y } = label.bounds;
    const { width, height } = label.bounds;

    if (x < minX) x = minX;
    if (y < minY) y = minY;
    if (x + width > maxX) x = Math.max(minX, maxX - width);
    if (y + height > maxY) y = Math.max(minY, maxY - height);

    if (keepOutRects.length) {
      const cleared = clearKeepOuts({ x, y, width, height }, keepOutRects, {
        minX,
        minY,
        maxX,
        maxY,
      });
      x = cleared.x;
      y = cleared.y;
    }

    const dx = x - label.bounds.x;
    const dy = y - label.bounds.y;
    if (dx === 0 && dy === 0) return label;

    // Keep the path anchor where it is — only the pill moves — so leaders still
    // connect the stroke to the label after clamp nudges.
    return {
      ...label,
      bounds: { ...label.bounds, x, y },
    };
  });
}

function clearKeepOuts(
  bounds: Rect,
  keepOutRects: Rect[],
  lim: { minX: number; minY: number; maxX: number; maxY: number },
): Rect {
  let { x, y, width, height } = bounds;

  for (let pass = 0; pass < 4; pass++) {
    let hit: Rect | undefined;
    for (const zone of keepOutRects) {
      if (rectsOverlap({ x, y, width, height }, zone, 0)) {
        hit = zone;
        break;
      }
    }
    if (!hit) break;

    const candidates = [
      { x, y: hit.y - height - LABEL_MARGIN },
      { x, y: hit.y + hit.height + LABEL_MARGIN },
      { x: hit.x + hit.width + LABEL_MARGIN, y },
      { x: hit.x - width - LABEL_MARGIN, y },
    ];

    let best: { x: number; y: number; score: number } | undefined;
    for (const c of candidates) {
      let cx = c.x;
      let cy = c.y;
      if (cx < lim.minX) cx = lim.minX;
      if (cy < lim.minY) cy = lim.minY;
      if (cx + width > lim.maxX) cx = Math.max(lim.minX, lim.maxX - width);
      if (cy + height > lim.maxY) cy = Math.max(lim.minY, lim.maxY - height);

      const next = { x: cx, y: cy, width, height };
      let score = Math.abs(cx - x) + Math.abs(cy - y);
      for (const zone of keepOutRects) {
        if (rectsOverlap(next, zone, 0)) score += 10_000;
      }
      if (!best || score < best.score) best = { x: cx, y: cy, score };
    }
    if (best) {
      x = best.x;
      y = best.y;
    }
  }

  return { x, y, width, height };
}
