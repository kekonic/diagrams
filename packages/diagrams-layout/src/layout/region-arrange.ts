import type { GraphGroup, RegionAlign, RegionArrange, TrackSpec } from "@kekonic/diagrams-core";
import type { Rect } from "@kekonic/diagrams-core";
import { DENSITY_GAP, DEFAULT_GROUP_GAP } from "./constants.ts";

export type RegionCell = {
  groupId: string;
  /** Intrinsic content size before stretch. */
  width: number;
  height: number;
  column?: number | string;
  row?: number | string;
  colSpan?: number;
  rowSpan?: number;
};

export type RegionArrangeInput = {
  arrange: RegionArrange;
  align?: RegionAlign;
  gap?: string | number;
  columns?: TrackSpec;
  rows?: TrackSpec;
  cells: RegionCell[];
  /** Origin of the parent content box. */
  origin?: { x: number; y: number };
};

export type ArrangedRegion = {
  groupId: string;
  bounds: Rect;
};

const GAP_PRESETS: Record<string, number> = {
  compact: DENSITY_GAP.compact,
  normal: DENSITY_GAP.normal,
  spacious: DENSITY_GAP.spacious,
};

export function resolveArrangeGap(gap: string | number | undefined): number {
  if (typeof gap === "number" && Number.isFinite(gap)) return Math.max(0, gap);
  if (typeof gap === "string" && GAP_PRESETS[gap] != null) return GAP_PRESETS[gap]!;
  return DEFAULT_GROUP_GAP;
}

function trackCount(spec: TrackSpec | undefined, fallback: number): number {
  if (typeof spec === "number") return Math.max(1, Math.floor(spec));
  if (Array.isArray(spec)) return Math.max(1, spec.length);
  return Math.max(1, fallback);
}

function resolveTrackIndex(
  ref: number | string | undefined,
  spec: TrackSpec | undefined,
  fallbackIndex: number,
  count: number,
): number {
  if (typeof ref === "number" && ref >= 1) {
    return Math.min(count - 1, Math.max(0, Math.floor(ref) - 1));
  }
  if (typeof ref === "string" && Array.isArray(spec)) {
    const idx = spec.indexOf(ref);
    if (idx >= 0) return idx;
  }
  return Math.min(count - 1, Math.max(0, fallbackIndex));
}

function alignOffset(align: RegionAlign, free: number): number {
  if (free <= 0) return 0;
  switch (align) {
    case "end":
      return free;
    case "center":
      return free / 2;
    case "start":
    case "stretch":
    default:
      return 0;
  }
}

/**
 * Place sibling region cells into stack / row / grid tracks.
 * Pure geometry — no ELK. Stretch equalizes the cross-axis.
 */
export function regionArrange(input: RegionArrangeInput): ArrangedRegion[] {
  const align = input.align ?? "stretch";
  const gap = resolveArrangeGap(input.gap);
  const originX = input.origin?.x ?? 0;
  const originY = input.origin?.y ?? 0;
  const cells = input.cells;
  if (cells.length === 0) return [];

  if (input.arrange === "stack") {
    return arrangeStack(cells, align, gap, originX, originY);
  }
  if (input.arrange === "row") {
    return arrangeRow(cells, align, gap, originX, originY);
  }
  return arrangeGrid(input, align, gap, originX, originY);
}

function arrangeStack(
  cells: RegionCell[],
  align: RegionAlign,
  gap: number,
  originX: number,
  originY: number,
): ArrangedRegion[] {
  const maxW = Math.max(...cells.map((c) => c.width), 0);
  let y = originY;
  const out: ArrangedRegion[] = [];
  for (const cell of cells) {
    const width = align === "stretch" ? maxW : cell.width;
    const x = originX + alignOffset(align, maxW - width);
    out.push({
      groupId: cell.groupId,
      bounds: { x, y, width, height: cell.height },
    });
    y += cell.height + gap;
  }
  return out;
}

function arrangeRow(
  cells: RegionCell[],
  align: RegionAlign,
  gap: number,
  originX: number,
  originY: number,
): ArrangedRegion[] {
  const maxH = Math.max(...cells.map((c) => c.height), 0);
  let x = originX;
  const out: ArrangedRegion[] = [];
  for (const cell of cells) {
    const height = align === "stretch" ? maxH : cell.height;
    const y = originY + alignOffset(align, maxH - height);
    out.push({
      groupId: cell.groupId,
      bounds: { x, y, width: cell.width, height },
    });
    x += cell.width + gap;
  }
  return out;
}

function arrangeGrid(
  input: RegionArrangeInput,
  align: RegionAlign,
  gap: number,
  originX: number,
  originY: number,
): ArrangedRegion[] {
  const cells = input.cells;
  // Auto-flow by source order when column/row omitted.
  let autoCol = 0;
  let autoRow = 0;
  const colCountHint = trackCount(input.columns, 1);
  const placements = cells.map((cell) => {
    const colSpan = Math.max(1, cell.colSpan ?? 1);
    const rowSpan = Math.max(1, cell.rowSpan ?? 1);
    let col = resolveTrackIndex(cell.column, input.columns, autoCol, colCountHint);
    let row = resolveTrackIndex(cell.row, input.rows, autoRow, trackCount(input.rows, 1));
    if (cell.column == null && cell.row == null) {
      col = autoCol;
      row = autoRow;
      autoCol += colSpan;
      if (autoCol >= colCountHint) {
        autoCol = 0;
        autoRow += 1;
      }
    }
    return { cell, col, row, colSpan, rowSpan };
  });

  const maxCol = Math.max(colCountHint, ...placements.map((p) => p.col + p.colSpan));
  const maxRow = Math.max(trackCount(input.rows, 1), ...placements.map((p) => p.row + p.rowSpan));

  const colWidths = Array.from({ length: maxCol }, () => 0);
  const rowHeights = Array.from({ length: maxRow }, () => 0);
  for (const p of placements) {
    const perCol = p.cell.width / p.colSpan;
    const perRow = p.cell.height / p.rowSpan;
    for (let c = p.col; c < p.col + p.colSpan; c++) {
      colWidths[c] = Math.max(colWidths[c]!, perCol);
    }
    for (let r = p.row; r < p.row + p.rowSpan; r++) {
      rowHeights[r] = Math.max(rowHeights[r]!, perRow);
    }
  }

  const colX: number[] = [];
  let x = originX;
  for (let c = 0; c < maxCol; c++) {
    colX.push(x);
    x += colWidths[c]! + (c < maxCol - 1 ? gap : 0);
  }
  const rowY: number[] = [];
  let y = originY;
  for (let r = 0; r < maxRow; r++) {
    rowY.push(y);
    y += rowHeights[r]! + (r < maxRow - 1 ? gap : 0);
  }

  return placements.map((p) => {
    let width = 0;
    for (let c = p.col; c < p.col + p.colSpan; c++) {
      width += colWidths[c]!;
      if (c < p.col + p.colSpan - 1) width += gap;
    }
    let height = 0;
    for (let r = p.row; r < p.row + p.rowSpan; r++) {
      height += rowHeights[r]!;
      if (r < p.row + p.rowSpan - 1) height += gap;
    }
    const cellW = align === "stretch" ? width : p.cell.width;
    const cellH = align === "stretch" ? height : p.cell.height;
    const ox = alignOffset(align, width - cellW);
    const oy = alignOffset(align, height - cellH);
    return {
      groupId: p.cell.groupId,
      bounds: {
        x: colX[p.col]! + ox,
        y: rowY[p.row]! + oy,
        width: cellW,
        height: cellH,
      },
    };
  });
}

/** True when a group or diagram options request region arrangement. */
export function groupHasRegionArrange(group: GraphGroup): boolean {
  return group.arrange === "stack" || group.arrange === "row" || group.arrange === "grid";
}
