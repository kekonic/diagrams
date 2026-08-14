import type { BoxPadding, GraphModel, Rect } from "@kekonic/diagrams-core";
import type { LaidOutGroup, LaidOutNode } from "./types.ts";
import { DEFAULT_GROUP_PADDING, LAYOUT_ONLY_GROUP_PADDING, PADDING_HINTS } from "./constants.ts";

const GROUP_LABEL_FONT_SIZE = 11;
const GROUP_LABEL_LETTER_SPACING = 0.08;
const GROUP_LABEL_PADDING_X = 14;
const GROUP_LABEL_PADDING_Y = 10;
export const GROUP_ICON_SIZE = 14;
export const GROUP_ICON_GAP = 6;

export function paddingForGroup(group: GraphModel["groups"][0]): BoxPadding {
  const chromeless = group.chrome === false;
  let base: BoxPadding;
  if (group.paddingHint && PADDING_HINTS[group.paddingHint]) {
    const p = PADDING_HINTS[group.paddingHint]!;
    // No label band — flatten top to match the horizontal inset.
    base = chromeless ? { top: p.left, right: p.right, bottom: p.bottom, left: p.left } : p;
  } else if (group.paddingHint != null) {
    const n = Number(group.paddingHint);
    if (Number.isFinite(n) && n >= 0) {
      base = { top: n, right: n, bottom: n, left: n };
    } else {
      base = chromeless ? LAYOUT_ONLY_GROUP_PADDING : DEFAULT_GROUP_PADDING;
    }
  } else {
    base = chromeless ? LAYOUT_ONLY_GROUP_PADDING : DEFAULT_GROUP_PADDING;
  }
  return withShapeChromePadding(group.shape, base, chromeless);
}

/** Extra inset so AABB content stays inside hex/circle/ellipse silhouettes. */
export function withShapeChromePadding(
  shape: string | undefined,
  base: BoxPadding,
  chromeless: boolean,
): BoxPadding {
  if (chromeless || !shape) return base;
  const id = shape.trim().toLowerCase();
  if (id !== "hexagon" && id !== "circle" && id !== "ellipse") return base;
  const extra = Math.max(16, Math.round(Math.max(base.left, base.right, 24) * 0.4));
  return {
    top: base.top + extra,
    right: base.right + extra,
    bottom: base.bottom + extra,
    left: base.left + extra,
  };
}

/** Expand bounds to a square centered on the same midpoint (circle/hex chrome). */
export function squareUpBounds(bounds: Rect): Rect {
  const side = Math.max(bounds.width, bounds.height);
  return {
    x: bounds.x - (side - bounds.width) / 2,
    y: bounds.y - (side - bounds.height) / 2,
    width: side,
    height: side,
  };
}

export function prefersSquareGroupChrome(shape: string | undefined): boolean {
  if (!shape) return false;
  const id = shape.trim().toLowerCase();
  return id === "hexagon" || id === "circle";
}

export function groupBoundsFromNodes(
  graph: GraphModel,
  laidOut: LaidOutNode[],
  padding: BoxPadding,
): Map<string, Rect> {
  const nodeMap = new Map(laidOut.map((n) => [n.nodeId, n]));
  const result = new Map<string, Rect>();

  for (const group of graph.groups) {
    const memberBounds = group.nodeIds
      .map((id) => nodeMap.get(id)?.bounds)
      .filter((b): b is Rect => !!b);
    if (!memberBounds.length) continue;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const b of memberBounds) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }

    result.set(group.id, {
      x: minX - padding.left,
      y: minY - padding.top,
      width: maxX - minX + padding.left + padding.right,
      height: maxY - minY + padding.top + padding.bottom,
    });
  }

  return result;
}

export function measureGroupLabelBox(label: string, bounds: Rect, hasIcon = false): Rect {
  const text = label.toUpperCase();
  const charWidth = GROUP_LABEL_FONT_SIZE * (0.55 + GROUP_LABEL_LETTER_SPACING * 0.3);
  const iconExtra = hasIcon ? GROUP_ICON_SIZE + GROUP_ICON_GAP : 0;
  const width = Math.min(
    Math.max(text.length * charWidth + 8 + iconExtra, 48),
    Math.max(bounds.width - 8, 48),
  );
  const height = GROUP_LABEL_FONT_SIZE + 8;
  return {
    x: bounds.x + GROUP_LABEL_PADDING_X,
    y: bounds.y + GROUP_LABEL_PADDING_Y,
    width,
    height,
  };
}

export function computeGroupBounds(graph: GraphModel, laidOut: LaidOutNode[]): LaidOutGroup[] {
  const result: LaidOutGroup[] = [];

  for (const group of graph.groups) {
    const padding = paddingForGroup(group);
    const boundsMap = groupBoundsFromNodes(graph, laidOut, padding);
    const bounds = boundsMap.get(group.id);
    if (!bounds) continue;
    const hasIcon = Boolean(group.icon && group.icon !== "none" && group.chrome !== false);
    result.push({
      groupId: group.id,
      bounds,
      labelBox: measureGroupLabelBox(group.label, bounds, hasIcon),
      padding,
    });
  }
  return result;
}
