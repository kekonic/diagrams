import type { GraphNode, TableColumn } from "@kekonic/diagrams-core";
import {
  TABLE_HEADER_H,
  TABLE_NOTE_LINE,
  TABLE_ROW_H,
  TABLE_PAD_X,
  TABLE_KEY_COL,
  TABLE_RX,
  TABLE_BADGE_W,
  TABLE_BADGE_GAP,
  TABLE_ATTR_GAP,
  tableKeyBadges,
  columnTypeLabel,
  columnNoteLabel,
  isErdTableNode,
  tableHasNote,
  tableHeaderHeight,
} from "@kekonic/diagrams-layout";
import { escapeXml } from "./utils.ts";

export { isErdTableNode };

function badgeClassName(badge: string): string {
  switch (badge) {
    case "PK":
      return "flow-table-badge flow-table-badge-pk";
    case "FK":
      return "flow-table-badge flow-table-badge-fk";
    case "UK":
      return "flow-table-badge flow-table-badge-uk";
    default:
      return "flow-table-badge";
  }
}

/**
 * Dense ERD entity card — neutral fill for readable column text,
 * accent reserved for stroke/badges, subtle header band.
 */
export function renderTableBackground(
  bounds: { x: number; y: number; width: number; height: number },
  nodeId: string,
  scale = 1,
  roundedCorners = false,
  headerHeight?: number,
): string {
  const { x, y, width, height } = bounds;
  const rx = roundedCorners ? TABLE_RX * scale : 0;
  const headerH = headerHeight ?? TABLE_HEADER_H * scale;
  // Include node id so clip paths stay unique when two tables share bounds.
  const safeId = nodeId.replace(/[^A-Za-z0-9_-]/g, "_");
  const clipId = `kd-table-clip-${safeId}`;
  // Stroke is painted after fills so the header band cannot cover the top edge
  // (that used to make the bottom border look thicker than the other sides).
  const strokeW = 1.5;
  const inset = strokeW / 2;
  const clipRx = Math.max(0, rx - inset);
  let out = "";
  out += `<rect class="flow-table-shell" x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="var(--kd-table-fill, var(--node-fill, var(--kd-node-fill)))" stroke="none"/>`;
  out += `<defs><clipPath id="${clipId}"><rect x="${x + inset}" y="${y + inset}" width="${Math.max(0, width - strokeW)}" height="${Math.max(0, height - strokeW)}" rx="${clipRx}"/></clipPath></defs>`;
  out += `<rect class="flow-table-header" x="${x}" y="${y}" width="${width}" height="${headerH}" clip-path="url(#${clipId})" fill="var(--kd-table-header-fill, var(--kd-surface-2, var(--kd-surface)))"/>`;
  out += `<rect class="flow-table-border" x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="none" stroke="var(--node-stroke, var(--kd-node-stroke))" stroke-width="${strokeW}"/>`;
  return out;
}

export function renderTableForeground(
  node: GraphNode,
  bounds: { x: number; y: number; width: number; height: number },
  roundedCorners = false,
): string {
  const { x, y, width } = bounds;
  const scale = node.scale && node.scale > 0 ? node.scale : 1;
  const headerH = tableHeaderHeight(node, scale);
  const rowH = TABLE_ROW_H * scale;
  const padX = TABLE_PAD_X * scale;
  const keyCol = TABLE_KEY_COL * scale;
  const badgeW = TABLE_BADGE_W * scale;
  const badgeGap = TABLE_BADGE_GAP * scale;
  const attrGap = TABLE_ATTR_GAP * scale;
  const badgeRx = roundedCorners ? 2 * scale : 0;
  const columns = node.columns ?? [];
  // Fixed name column — key chips never shove field names right.
  const nameX = x + padX + keyCol;
  const hasNote = tableHasNote(node);

  let out = "";
  const titleY = hasNote ? y + 11 * scale : y + headerH / 2 + 0.5;
  out += `<text class="flow-table-title" x="${x + padX}" y="${titleY}" dominant-baseline="middle" font-size="${12 * scale}">${escapeXml(node.label)}</text>`;
  if (hasNote) {
    const noteY = y + (TABLE_HEADER_H + TABLE_NOTE_LINE / 2) * scale;
    out += `<text class="flow-table-note" x="${x + padX}" y="${noteY}" dominant-baseline="middle" font-size="${10 * scale}">${escapeXml(node.note!.trim())}</text>`;
  }

  columns.forEach((col, i) => {
    const rowY = y + headerH + i * rowH;
    // Subtle zebra for scanability on wide schemas.
    if (i % 2 === 1) {
      out += `<rect class="flow-table-zebra" x="${x + 0.5}" y="${rowY}" width="${width - 1}" height="${rowH}" fill="var(--kd-table-zebra, transparent)"/>`;
    }
    const cy = rowY + rowH / 2;

    // Key gutter: PK/FK/UK only — left-aligned inside the fixed column.
    const badges = tableKeyBadges(col);
    let bx = x + padX;
    for (const badge of badges) {
      const badgeH = 12 * scale;
      out += `<rect class="${badgeClassName(badge)}" x="${bx}" y="${cy - badgeH / 2}" width="${badgeW}" height="${badgeH}" rx="${badgeRx}"/>`;
      out += `<text class="flow-table-badge-text" x="${bx + badgeW / 2}" y="${cy + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="${8 * scale}">${badge}</text>`;
      bx += badgeW + badgeGap;
    }

    const nameClass = col.keys.includes("pk")
      ? "flow-table-col-name flow-table-col-pk"
      : "flow-table-col-name";
    out += `<text class="${nameClass}" x="${nameX}" y="${cy}" dominant-baseline="middle" font-size="${11 * scale}">${escapeXml(col.name)}</text>`;

    // Right cluster (end-anchored L→R): type, NN, note — no middle-dot joins.
    // Clip attrs to the region after the name so they cannot paint over it if width is tight.
    const typeLabel = columnTypeLabel(col);
    const noteLabel = columnNoteLabel(col);
    const showNn = Boolean(col.notNull);
    if (typeLabel || noteLabel || showNn) {
      const safeId = node.id.replace(/[^A-Za-z0-9_-]/g, "_");
      const clipId = `kd-table-attrs-${safeId}-${i}`;
      // Reserve ~name glyph width so clip starts after the field name.
      const nameReserve = Math.max(24 * scale, col.name.length * 11 * scale * 0.56);
      const attrsLeft = nameX + nameReserve + 8 * scale;
      const attrsRight = x + width - padX;
      const clipW = Math.max(0, attrsRight - attrsLeft);
      out += `<defs><clipPath id="${clipId}"><rect x="${attrsLeft}" y="${rowY}" width="${clipW}" height="${rowH}"/></clipPath></defs>`;
      out += `<text class="flow-table-col-attrs" clip-path="url(#${clipId})" x="${attrsRight}" y="${cy}" text-anchor="end" dominant-baseline="middle" font-size="${10 * scale}">`;
      let needGap = false;
      if (typeLabel) {
        out += `<tspan class="flow-table-col-type">${escapeXml(typeLabel)}</tspan>`;
        needGap = true;
      }
      if (showNn) {
        // Quiet nullability marker on the type side — not a key-gutter chip.
        out += `<tspan class="flow-table-col-nn"${needGap ? ` dx="${attrGap}"` : ""}>NN</tspan>`;
        needGap = true;
      }
      if (noteLabel) {
        out += `<tspan class="flow-table-col-note"${needGap ? ` dx="${attrGap}"` : ""}>${escapeXml(noteLabel)}</tspan>`;
      }
      out += `</text>`;
    }
  });

  return out;
}

export type { TableColumn };
