import type { Point, Rect } from "@kekonic/diagrams-core";

/** Edge label bounds produced by ELK and painted by the SVG renderer. */
export type EdgeLabelPlacement = {
  edgeId: string;
  text: string;
  bounds: Rect;
  anchor: Point;
};

/** Icon size inside an edge-label pill (logical units). Keep in sync with SVG paint. */
export const EDGE_LABEL_ICON = 12;
/** Gap between edge-label icon and text. */
export const EDGE_LABEL_ICON_GAP = 4;
/** Horizontal padding inside the edge-label pill. */
export const EDGE_LABEL_PAD_X = 8;
