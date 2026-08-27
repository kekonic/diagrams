import { getThemeTokens } from "@kekonic/diagrams-theme";
import {
  accentWash,
  hexToOklch,
  isDarkOklch,
  neutralAt,
  oklchCss,
  oklchToHex,
  parseHex,
  shiftHueOklch,
  toHex,
  withAlpha,
  type Oklch,
} from "./color.ts";

type ThemeTokens = Record<string, string>;

/** Registered name for live studio-derived diagram theme. */
export const LIVE_THEME_NAME = "studio-live";

/**
 * Two seeds drive the palette:
 * - accent — interactive / brand
 * - neutral — gray family (bg, surfaces, text, borders)
 * Mode keeps semantic success/danger/warning from built-ins.
 */
export type ThemeSeeds = {
  mode: "dark" | "light";
  accent: string;
  neutral: string;
};

export type ChromeTokens = {
  "--bg": string;
  "--bg-elevated": string;
  "--bg-panel": string;
  "--bg-input": string;
  "--border": string;
  "--border-soft": string;
  "--text": string;
  "--text-muted": string;
  "--text-faint": string;
  "--accent": string;
  "--accent-soft": string;
  /** Text/icon colour to place on top of --accent. */
  "--accent-contrast": string;
  /** Mid-tone filled brand surface (primary buttons); theme-independent. */
  "--accent-strong": string;
  "--accent-strong-hover": string;
  "--on-accent-strong": string;
  "--focus": string;
  "--shadow": string;
};

/** Purple brand accent; neutrals stay near-gray on the same hue. */
export function defaultSeeds(mode: "dark" | "light"): ThemeSeeds {
  if (mode === "light") {
    return {
      mode,
      accent: oklchToHex({ l: 0.47, c: 0.183, h: 301 }),
      neutral: oklchToHex({ l: 0.975, c: 0.012, h: 301 }),
    };
  }
  return {
    mode,
    accent: oklchToHex({ l: 0.72, c: 0.14, h: 301 }),
    neutral: oklchToHex({ l: 0.16, c: 0.02, h: 301 }),
  };
}

/** Named accent/neutral packs for the studio theme panel. */
export type ThemePresetId = "default" | "ocean" | "forest" | "ember" | "slate";

export const THEME_PRESETS: ReadonlyArray<{
  id: ThemePresetId;
  label: string;
}> = [
  { id: "default", label: "Default" },
  { id: "ocean", label: "Ocean" },
  { id: "forest", label: "Forest" },
  { id: "ember", label: "Ember" },
  { id: "slate", label: "Slate" },
];

export function seedsForPreset(id: ThemePresetId, mode: "dark" | "light"): ThemeSeeds {
  if (id === "default") return defaultSeeds(mode);
  const dark = mode === "dark";
  switch (id) {
    case "ocean":
      return {
        mode,
        accent: oklchToHex({ l: dark ? 0.78 : 0.45, c: dark ? 0.09 : 0.1, h: 230 }),
        neutral: oklchToHex({ l: dark ? 0.16 : 0.97, c: 0.012, h: 230 }),
      };
    case "forest":
      return {
        mode,
        accent: oklchToHex({ l: dark ? 0.78 : 0.42, c: dark ? 0.1 : 0.11, h: 150 }),
        neutral: oklchToHex({ l: dark ? 0.155 : 0.97, c: 0.01, h: 145 }),
      };
    case "ember":
      return {
        mode,
        accent: oklchToHex({ l: dark ? 0.76 : 0.5, c: dark ? 0.12 : 0.13, h: 40 }),
        neutral: oklchToHex({ l: dark ? 0.15 : 0.97, c: 0.012, h: 50 }),
      };
    case "slate":
      return {
        mode,
        accent: oklchToHex({ l: dark ? 0.82 : 0.38, c: 0.01, h: 260 }),
        neutral: oklchToHex({ l: dark ? 0.14 : 0.96, c: 0.004, h: 260 }),
      };
  }
}

function normalizeHex(hex: string): string {
  const rgb = parseHex(hex);
  return rgb ? toHex(rgb).toLowerCase() : hex.trim().toLowerCase();
}

/**
 * Switch dark/light while keeping customized accent hue.
 * Neutral: if still the previous mode default, adopt the new default;
 * otherwise remap lightness into the new mode and keep hue/chroma.
 */
export function seedsForModeToggle(prev: ThemeSeeds, mode: "dark" | "light"): ThemeSeeds {
  const prevDefaults = defaultSeeds(prev.mode);
  const nextDefaults = defaultSeeds(mode);
  const neutralWasDefault = normalizeHex(prev.neutral) === normalizeHex(prevDefaults.neutral);
  const accentWasDefault = normalizeHex(prev.accent) === normalizeHex(prevDefaults.accent);

  return {
    mode,
    accent: accentWasDefault ? nextDefaults.accent : remapAccentForMode(prev.accent, mode),
    neutral: neutralWasDefault
      ? nextDefaults.neutral
      : remapNeutralForMode(prev.neutral, mode, nextDefaults.neutral),
  };
}

/** Keep hue/chroma; park lightness in the target mode's band. */
function remapNeutralForMode(hex: string, mode: "dark" | "light", fallback: string): string {
  const color = hexToOklch(hex);
  const target = hexToOklch(fallback);
  if (!color || !target) return fallback;
  return oklchToHex({ l: target.l, c: color.c, h: color.h });
}

function remapAccentForMode(hex: string, mode: "dark" | "light"): string {
  const color = hexToOklch(hex);
  if (!color) return hex;
  const l =
    mode === "dark"
      ? Math.max(0.55, Math.min(0.86, color.l))
      : Math.max(0.28, Math.min(0.5, color.l));
  return oklchToHex({ ...color, l });
}

export function normalizeSeeds(
  mode: "dark" | "light",
  stored: Partial<ThemeSeeds> | null,
): ThemeSeeds {
  const defaults = defaultSeeds(mode);
  if (!stored) return defaults;
  return {
    mode,
    accent: typeof stored.accent === "string" ? stored.accent : defaults.accent,
    neutral: typeof stored.neutral === "string" ? stored.neutral : defaults.neutral,
  };
}

function requireOklch(hex: string, fallback: Oklch): Oklch {
  return hexToOklch(hex) ?? fallback;
}

/** If neutral lightness disagrees with mode, keep hue/chroma and use a mode-safe L. */
function modeAlignedNeutral(neutral: Oklch, dark: boolean): Oklch {
  if (dark === isDarkOklch(neutral)) return neutral;
  return neutralAt(neutral, dark ? 0.155 : 0.97);
}

export function deriveChromeTokens(seeds: ThemeSeeds): ChromeTokens {
  const accent = requireOklch(seeds.accent, { l: 0.72, c: 0.14, h: 301 });
  const neutralSeed = requireOklch(seeds.neutral, { l: 0.16, c: 0.02, h: 301 });
  // Mode owns light vs dark; neutral only supplies hue/chroma (+ lightness when aligned).
  const dark = seeds.mode === "dark";
  const neutral = modeAlignedNeutral(neutralSeed, dark);

  const bg = neutralAt(neutral, neutral.l);
  const elevated = neutralAt(neutral, dark ? neutral.l + 0.04 : neutral.l - 0.03);
  const panel = neutralAt(neutral, dark ? neutral.l + 0.025 : neutral.l - 0.02);
  const input = neutralAt(
    neutral,
    dark ? Math.max(0.08, neutral.l - 0.03) : Math.min(1, neutral.l + 0.01),
  );
  const border = neutralAt(neutral, dark ? neutral.l + 0.14 : neutral.l - 0.18, 1.2);
  const borderSoft = neutralAt(neutral, dark ? neutral.l + 0.08 : neutral.l - 0.1, 0.9);
  const text = neutralAt(neutral, dark ? 0.93 : 0.18, 0.4);
  const muted = neutralAt(neutral, dark ? 0.68 : 0.42, 0.5);
  const faint = neutralAt(neutral, dark ? 0.48 : 0.58, 0.4);

  return {
    "--bg": oklchCss(bg),
    "--bg-elevated": oklchCss(elevated),
    "--bg-panel": oklchCss(panel),
    "--bg-input": oklchCss(input),
    "--border": oklchCss(border),
    "--border-soft": oklchCss(borderSoft),
    "--text": oklchCss(text),
    "--text-muted": oklchCss(muted),
    "--text-faint": oklchCss(faint),
    "--accent": oklchCss(accent),
    "--accent-soft": oklchCss(accent, dark ? 0.18 : 0.12),
    // Follows the seed, not the mode: a light accent needs dark text on it even
    // in dark mode, or labels on accent-filled controls wash out.
    "--accent-contrast": oklchCss(
      accent.l > 0.6 ? neutralAt(neutral, 0.16, 0.4) : neutralAt(neutral, 0.98, 0.3),
    ),
    // Filled brand buttons stay mid-tone regardless of seed lightness, so a white
    // label stays legible in both modes. Hue rides with the accent seed.
    "--accent-strong": oklchCss({
      l: 0.47,
      c: Math.min(0.183, Math.max(0.08, accent.c)),
      h: accent.h,
    }),
    "--accent-strong-hover": oklchCss({
      l: 0.42,
      c: Math.min(0.18, Math.max(0.08, accent.c * 0.9)),
      h: accent.h,
    }),
    "--on-accent-strong": oklchCss(neutralAt(neutral, 0.98, 0.3)),
    "--focus": oklchCss(accent, dark ? 0.45 : 0.4),
    "--shadow": dark ? "0 12px 40px oklch(0% 0 0 / 0.45)" : "0 12px 40px oklch(20% 0 0 / 0.12)",
  };
}

export function applyChromeTokens(tokens: ChromeTokens): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
}

export function deriveThemeTokens(seeds: ThemeSeeds): ThemeTokens {
  const base = getThemeTokens(seeds.mode);
  const accent = requireOklch(seeds.accent, { l: 0.72, c: 0.14, h: 301 });
  const neutralSeed = requireOklch(seeds.neutral, { l: 0.16, c: 0.02, h: 301 });
  const dark = seeds.mode === "dark";
  const neutral = modeAlignedNeutral(neutralSeed, dark);

  const bg = oklchToHex(neutralAt(neutral, neutral.l));
  const surface = oklchToHex(neutralAt(neutral, dark ? neutral.l + 0.05 : neutral.l - 0.03));
  const surface2 = oklchToHex(neutralAt(neutral, dark ? neutral.l + 0.09 : neutral.l - 0.06));
  const surface3 = oklchToHex(neutralAt(neutral, dark ? neutral.l + 0.14 : neutral.l - 0.1));
  const text = oklchToHex(neutralAt(neutral, dark ? 0.93 : 0.2, 0.35));
  const muted = oklchToHex(neutralAt(neutral, dark ? 0.68 : 0.45, 0.45));
  const border = oklchToHex(neutralAt(neutral, dark ? neutral.l + 0.16 : neutral.l - 0.2, 1.1));
  const edge = oklchToHex(neutralAt(neutral, dark ? 0.62 : 0.5, 0.7));
  const accentHex = oklchToHex(accent);
  const surfaceL = hexToOklch(surface)?.l ?? (dark ? 0.22 : 0.96);

  const fillToward = (amount: number) => oklchToHex(accentWash(accent, surfaceL, amount));
  const dataAccent = oklchToHex(shiftHueOklch(accent, 28));

  return {
    ...base,
    "--kd-bg": bg,
    "--kd-surface": surface,
    "--kd-surface-2": surface2,
    "--kd-surface-3": surface3,
    "--kd-text": text,
    "--kd-muted": muted,
    "--kd-border": border,
    "--kd-edge": edge,
    "--kd-edge-label-bg": surface2,
    "--kd-edge-label-text": text,
    "--kd-edge-label-stroke": border,
    "--kd-accent": accentHex,
    "--kd-user-fill": fillToward(dark ? 0.7 : 0.45),
    "--kd-user-stroke": accentHex,
    "--kd-service-fill": fillToward(dark ? 0.55 : 0.35),
    "--kd-service-stroke": accentHex,
    "--kd-data-fill": oklchToHex(accentWash(shiftHueOklch(accent, 28), surfaceL, dark ? 0.6 : 0.4)),
    "--kd-data-stroke": dataAccent,
    // Dense column text needs neutral fills — accent only on stroke/badges.
    "--kd-table-fill": surface,
    "--kd-table-header-fill": surface2,
    "--kd-table-title": text,
    "--kd-table-zebra": withAlpha(border, dark ? 0.35 : 0.45),
    "--kd-table-badge-pk-fill": accentHex,
    "--kd-table-badge-fk-fill": oklchToHex({
      ...shiftHueOklch(accent, 40),
      c: Math.min(0.06, accent.c + 0.01),
      l: dark ? Math.min(0.55, accent.l - 0.1) : Math.max(0.4, accent.l),
    }),
    "--kd-table-badge-uk-fill": oklchToHex(
      accentWash(
        hexToOklch(base["--kd-success"] ?? accentHex) ?? { l: 0.7, c: 0.1, h: 160 },
        surfaceL,
        dark ? 0.7 : 0.5,
      ),
    ),
    "--kd-table-badge-text": dark ? text : "#ffffff",
    "--kd-event-fill": fillToward(dark ? 0.4 : 0.25),
    "--kd-event-stroke": base["--kd-success"] ?? accentHex,
    "--kd-external-fill": surface2,
    "--kd-external-stroke": muted,
    "--kd-group-fill": withAlpha(accentHex, dark ? 0.08 : 0.06),
    "--kd-group-stroke": withAlpha(accentHex, dark ? 0.35 : 0.28),
    "--kd-grid-dot": withAlpha(accentHex, dark ? 0.1 : 0.08),
    "--kd-node-fill": "var(--kd-surface)",
    "--kd-node-stroke": "var(--kd-border)",
    "--kd-node-shadow": dark ? "rgba(0, 0, 0, 0.42)" : "rgba(15, 23, 42, 0.1)",
    "--kd-node-glow": withAlpha(accentHex, dark ? 0.14 : 0.08),
    "--kd-port-fill": "var(--kd-bg)",
    "--kd-port-stroke": "var(--kd-accent)",
    "--kd-choice-fill": oklchToHex(
      accentWash(shiftHueOklch(accent, 40), surfaceL, dark ? 0.55 : 0.35),
    ),
    "--kd-choice-stroke": base["--kd-choice"] ?? oklchToHex(shiftHueOklch(accent, 40)),
    "--kd-success-fill": oklchToHex(
      accentWash(
        hexToOklch(base["--kd-success"] ?? accentHex) ?? { l: 0.7, c: 0.1, h: 160 },
        surfaceL,
        dark ? 0.5 : 0.3,
      ),
    ),
    "--kd-success-stroke": base["--kd-success"]!,
    "--kd-warning-fill": oklchToHex(
      accentWash(
        hexToOklch(base["--kd-warning"] ?? accentHex) ?? { l: 0.78, c: 0.12, h: 70 },
        surfaceL,
        dark ? 0.5 : 0.3,
      ),
    ),
    "--kd-warning-stroke": base["--kd-warning"]!,
  };
}
