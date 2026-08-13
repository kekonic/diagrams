import type { IconDisplaySize } from "./types.ts";

const DEFAULT_MAX_ASPECT = 1.75;

/**
 * Fixed-height, aspect-ratio width for an icon glyph.
 * Clamps width to `maxAspect * height` so extreme banners don't blow out cards.
 */
export function iconDisplaySize(
  icon: Pick<{ width: number; height: number }, "width" | "height">,
  height: number,
  options: { maxAspect?: number } = {},
): IconDisplaySize {
  const maxAspect = options.maxAspect ?? DEFAULT_MAX_ASPECT;
  const aspect = icon.width > 0 && icon.height > 0 ? icon.width / icon.height : 1;
  const width = Math.min(height * aspect, height * maxAspect);
  return { width: Math.max(0, width), height: Math.max(0, height) };
}
