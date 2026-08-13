/** OKLCH: L 0–1, C ≥ 0, H 0–360. */

export type Oklch = { l: number; c: number; h: number };
export type Rgb = { r: number; g: number; b: number };

export function parseHex(input: string): Rgb | null {
  const raw = input.trim().replace(/^#/, "");
  const hex =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToOklch(hex: string): Oklch | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return rgbToOklch(rgb);
}

export function oklchToHex(color: Oklch): string {
  return toHex(oklchToRgb(color));
}

export function oklchCss({ l, c, h }: Oklch, alpha?: number): string {
  const L = clamp01(l) * 100;
  const C = Math.max(0, c);
  const H = ((h % 360) + 360) % 360;
  if (alpha == null) return `oklch(${fmt(L)}% ${fmt(C)} ${fmt(H)})`;
  return `oklch(${fmt(L)}% ${fmt(C)} ${fmt(H)} / ${clamp01(alpha)})`;
}

export function isDarkOklch(color: Oklch): boolean {
  return color.l < 0.55;
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const a = clamp01(alpha);
  return `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, ${a})`;
}

/** Neutral ramp step: same hue, clamped chroma, new lightness. */
export function neutralAt(neutral: Oklch, l: number, chromaScale = 1): Oklch {
  return {
    l: clamp01(l),
    c: Math.max(0, Math.min(0.04, neutral.c) * chromaScale),
    h: Number.isFinite(neutral.h) ? neutral.h : 260,
  };
}

/** Accent tint for fills: pull toward surface lightness, keep accent hue. */
export function accentWash(accent: Oklch, surfaceL: number, amount: number): Oklch {
  const t = clamp01(amount);
  return {
    l: surfaceL + (accent.l - surfaceL) * t * 0.35 + (accent.l < surfaceL ? -0.02 : 0.02) * t,
    c: accent.c * t * 0.55,
    h: accent.h,
  };
}

export function shiftHueOklch(color: Oklch, degrees: number): Oklch {
  return { ...color, h: (((color.h + degrees) % 360) + 360) % 360 };
}

function fmt(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return clamp01(s) * 255;
}

function rgbToOklab({ r, g, b }: Rgb): { L: number; a: number; b: number } {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToRgb({ L, a, b }: { L: number; a: number; b: number }): Rgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: linearToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

function rgbToOklch(rgb: Rgb): Oklch {
  const { L, a, b } = rgbToOklab(rgb);
  const c = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h: c < 1e-6 ? 0 : h };
}

function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const H = ((h % 360) + 360) % 360;
  const rad = (H * Math.PI) / 180;
  return oklabToRgb({
    L: clamp01(l),
    a: c * Math.cos(rad),
    b: c * Math.sin(rad),
  });
}
