/**
 * Curated accent palette for per-group color storytelling.
 *
 * Group washes render at ~12% alpha, and amber/orange/red desaturate to olive,
 * brown, and maroon over a dark panel, which reads as mud rather than colour.
 * These hues are held to a similar lightness and kept out of the warm-yellow
 * band so the wash stays clean on both dark and light backgrounds. Adjacent
 * entries are also kept far apart in hue, since diagrams usually need only the
 * first few.
 */
export const GROUP_ACCENT_PALETTE = [
  "#a78bfa",
  "#34d399",
  "#38bdf8",
  "#f472b6",
  "#818cf8",
  "#e879f9",
  "#2dd4bf",
  "#60a5fa",
] as const;

export function groupAccentColor(index: number): string {
  return GROUP_ACCENT_PALETTE[index % GROUP_ACCENT_PALETTE.length]!;
}

export function groupAccentFill(accent: string): string {
  return `color-mix(in srgb, ${accent} 12%, transparent)`;
}
