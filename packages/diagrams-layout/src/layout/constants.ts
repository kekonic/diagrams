import type { BoxPadding, Density } from "@kekonic/diagrams-core";

export const DENSITY_GAP: Record<Density, number> = {
  compact: 56,
  normal: 88,
  spacious: 116,
};

export const DEFAULT_GROUP_PADDING: BoxPadding = {
  top: 56,
  right: 40,
  bottom: 40,
  left: 40,
};

/** Chromeless layout planes — no label headroom. */
export const LAYOUT_ONLY_GROUP_PADDING: BoxPadding = {
  top: 20,
  right: 20,
  bottom: 20,
  left: 20,
};

export const PADDING_HINTS: Record<string, BoxPadding> = {
  compact: { top: 36, right: 24, bottom: 24, left: 24 },
  normal: { top: 56, right: 40, bottom: 40, left: 40 },
  spacious: { top: 88, right: 60, bottom: 60, left: 60 },
  /** Iso-pixel platforms need extra pad so chunky cards + pipes clear the rim. */
  pixel: { top: 100, right: 80, bottom: 80, left: 80 },
};

export const GROUP_SEPARATION_MARGIN = 40;
export const LAYOUT_MARGIN = 64;
export const DEFAULT_GROUP_GAP = 72;
