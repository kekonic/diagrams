import type { GraphNode, TableColumn } from "@kekonic/diagrams-core";
import { DEFAULT_FONT_FAMILY, type TextMeasurer } from "./text-measurer.ts";

/** Dense ERD chrome — flatter and tighter than architecture cards. */
export const TABLE_PAD_X = 10;
export const TABLE_HEADER_H = 28;
export const TABLE_ROW_H = 20;
/** Badge chip width — must match SVG render. */
export const TABLE_BADGE_W = 18;
export const TABLE_BADGE_GAP = 3;
/**
 * Fixed key-badge gutter (fits PK+FK, or empty spacer).
 * Names always start at padX + KEY_COL regardless of how many key chips are present.
 */
export const TABLE_KEY_COL = TABLE_BADGE_W * 2 + TABLE_BADGE_GAP + 4;
export const TABLE_TYPE_GAP = 10;
export const TABLE_MIN_W = 180;
export const TABLE_RX = 4;
/** Gap between type / NN / note in the right-side attrs cluster. */
export const TABLE_ATTR_GAP = 6;

export type TableMeasure = {
  width: number;
  height: number;
  headerHeight: number;
  rowHeight: number;
  labelLines: string[];
};

export function isErdTableNode(node: GraphNode): boolean {
  return node.shape === "table" && Boolean(node.columns && node.columns.length > 0);
}

export function columnAnchorY(tableTop: number, rowIndex: number, scale = 1): number {
  const headerH = TABLE_HEADER_H * scale;
  const rowH = TABLE_ROW_H * scale;
  return tableTop + headerH + rowIndex * rowH + rowH / 2;
}

/** SQL-ish type only — muted mono on the right (flags/notes are separate). */
export function columnTypeLabel(col: TableColumn): string {
  return col.type?.trim() ?? "";
}

/** Enum / comment secondary text — never joined into the type with bullets. */
export function columnNoteLabel(col: TableColumn): string {
  return col.note?.trim() ?? "";
}

/**
 * Size an ERD table card from its title + columns using the shared text measurer.
 */
export function measureTableNode(
  node: GraphNode,
  measurer: TextMeasurer,
  scale: number,
  effectiveMinW: number,
  _effectiveMaxW: number,
): TableMeasure {
  const padX = TABLE_PAD_X * scale;
  const headerH = TABLE_HEADER_H * scale;
  const rowH = TABLE_ROW_H * scale;
  const keyCol = TABLE_KEY_COL * scale;
  const typeGap = TABLE_TYPE_GAP * scale;
  const attrGap = TABLE_ATTR_GAP * scale;
  const titleSize = 12 * scale;
  const colNameSize = 11 * scale;
  const colTypeSize = 10 * scale;
  const colNoteSize = 9.5 * scale;

  const titleMetrics = measurer.measureText(node.label, {
    fontSize: titleSize,
    fontFamily: DEFAULT_FONT_FAMILY,
    fontWeight: "700",
  });

  let maxRowContent = 0;
  const columns = node.columns ?? [];
  for (const col of columns) {
    const nameW = measurer.measureText(col.name, {
      fontSize: colNameSize,
      fontFamily: DEFAULT_FONT_FAMILY,
      fontWeight: "600",
    }).width;
    const typeLabel = columnTypeLabel(col);
    const noteLabel = columnNoteLabel(col);
    const typeW = typeLabel
      ? measurer.measureText(typeLabel, {
          fontSize: colTypeSize,
          fontFamily: DEFAULT_FONT_FAMILY,
          fontWeight: "500",
        }).width
      : 0;
    const noteW = noteLabel
      ? measurer.measureText(noteLabel, {
          fontSize: colNoteSize,
          fontFamily: DEFAULT_FONT_FAMILY,
          fontWeight: "500",
        }).width
      : 0;
    // Quiet "NN" on the type side (not in the key gutter), so names stay aligned.
    const nnW = col.notNull
      ? measurer.measureText("NN", {
          fontSize: colTypeSize,
          fontFamily: DEFAULT_FONT_FAMILY,
          fontWeight: "700",
        }).width
      : 0;
    const parts = [typeW, nnW, noteW].filter((w) => w > 0);
    const attrsW = parts.reduce((sum, w) => sum + w, 0) + Math.max(0, parts.length - 1) * attrGap;
    // Fixed key gutter + name + right attrs — badge count never shifts the name column.
    maxRowContent = Math.max(maxRowContent, keyCol + nameW + (attrsW ? typeGap + attrsW : 0));
  }

  const contentW = Math.max(titleMetrics.width + 8 * scale, maxRowContent) + padX * 2;
  // Size to content so right-anchored type/note never paint over the field name.
  // Kind default maxWidth is a soft preference elsewhere; ERD rows must fit their attrs.
  const width = Math.max(effectiveMinW, TABLE_MIN_W * scale, contentW);
  const height = headerH + Math.max(1, columns.length) * rowH;

  return {
    width,
    height,
    headerHeight: headerH,
    rowHeight: rowH,
    labelLines: [node.label],
  };
}

/** Key chips only (PK/FK/UK) — fixed left gutter; NN is not a key. */
export function tableKeyBadges(col: TableColumn): string[] {
  const badges: string[] = [];
  if (col.keys.includes("pk")) badges.push("PK");
  if (col.keys.includes("fk")) badges.push("FK");
  if (col.keys.includes("uk")) badges.push("UK");
  return badges;
}
