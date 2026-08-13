/**
 * Adapt Iconify bodies for themed diagram nodes.
 * Lucide/MDI often use currentColor already; brand logos (logos:aws) hardcode
 * dark fills that disappear on dark node backgrounds. Rewrite near-black ink to
 * currentColor while keeping chromatic brand accents (e.g. AWS orange).
 */

function parseHex(color: string): { r: number; g: number; b: number } | null {
  const raw = color.trim().toLowerCase();
  if (raw === "black") return { r: 0, g: 0, b: 0 };
  if (raw === "white") return { r: 255, g: 255, b: 255 };
  const short = /^#([0-9a-f]{3})$/i.exec(raw);
  if (short) {
    const h = short[1]!;
    return {
      r: Number.parseInt(h[0]! + h[0]!, 16),
      g: Number.parseInt(h[1]! + h[1]!, 16),
      b: Number.parseInt(h[2]! + h[2]!, 16),
    };
  }
  const long = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(raw);
  if (long) {
    const h = long[1]!;
    return {
      r: Number.parseInt(h.slice(0, 2), 16),
      g: Number.parseInt(h.slice(2, 4), 16),
      b: Number.parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(raw);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
    };
  }
  return null;
}

/** WCAG relative luminance (sRGB). */
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

/** True when a hardcoded color is "ink" that should follow the node theme. */
export function isThemeableInk(color: string): boolean {
  const value = color.trim().toLowerCase();
  if (
    !value ||
    value === "none" ||
    value === "currentcolor" ||
    value === "transparent" ||
    value.startsWith("url(") ||
    value.startsWith("var(")
  ) {
    return false;
  }
  const rgb = parseHex(value);
  if (!rgb) return false;
  // Near-black / dark slate — invisible on dark node fills; theme it.
  // Keep saturated brand colors (AWS orange, etc.).
  const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  if (lum <= 0.28 && saturation < 0.45) return true;
  if (lum <= 0.12) return true;
  return false;
}

/** Rewrite dark hardcoded fill/stroke paints to currentColor. */
export function adaptIconBodyColors(body: string): string {
  return body.replace(/\b(fill|stroke)="([^"]*)"/gi, (match, attr: string, value: string) => {
    if (!isThemeableInk(value)) return match;
    return `${attr}="currentColor"`;
  });
}
