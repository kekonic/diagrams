import { getThemeTokens, registerTheme } from "@kekonic/diagrams";

/** Registered interactive theme id for the VS Code side preview. */
export const VSCODE_PREVIEW_THEME = "vscode-preview";

export type VsCodePreviewColors = {
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  surface: string;
};

type ThemeTokens = ReturnType<typeof getThemeTokens>;

/** Resolve dark/light from the VS Code webview body classes. */
export function resolveVsCodeBodyMode(className: string): "dark" | "light" {
  const classes = className.split(/\s+/);
  if (classes.includes("vscode-light") || classes.includes("vscode-high-contrast-light")) {
    return "light";
  }
  return "dark";
}

/**
 * Build diagram tokens from VS Code workbench colors.
 * Keeps built-in semantic success/warning/danger; retints accent + neutrals.
 */
export function buildVsCodePreviewTokens(
  mode: "dark" | "light",
  colors: Partial<VsCodePreviewColors>,
): ThemeTokens {
  const base = getThemeTokens(mode);
  const accent = colors.accent || base["--kd-accent"]!;
  const background = colors.background || base["--kd-bg"]!;
  const foreground = colors.foreground || base["--kd-text"]!;
  const muted = colors.muted || base["--kd-muted"]!;
  const border = colors.border || base["--kd-border"]!;
  const surface = colors.surface || base["--kd-surface"]!;
  const wash = (amount: number) => `color-mix(in srgb, ${accent} ${amount}%, ${surface})`;
  const accentAlpha = (amount: number) => `color-mix(in srgb, ${accent} ${amount}%, transparent)`;

  return {
    ...base,
    "--kd-bg": background,
    "--kd-surface": surface,
    "--kd-surface-2": wash(mode === "dark" ? 8 : 6),
    "--kd-surface-3": wash(mode === "dark" ? 14 : 10),
    "--kd-text": foreground,
    "--kd-muted": muted,
    "--kd-border": border,
    "--kd-edge": muted,
    "--kd-edge-label-bg": surface,
    "--kd-edge-label-text": foreground,
    "--kd-edge-label-stroke": border,
    "--kd-accent": accent,
    "--kd-user-fill": wash(mode === "dark" ? 22 : 16),
    "--kd-user-stroke": accent,
    "--kd-service-fill": wash(mode === "dark" ? 18 : 12),
    "--kd-service-stroke": accent,
    "--kd-system-fill": wash(mode === "dark" ? 24 : 18),
    "--kd-system-stroke": accent,
    "--kd-container-fill": wash(mode === "dark" ? 18 : 12),
    "--kd-container-stroke": accent,
    "--kd-component-stroke": accent,
    "--kd-port-stroke": accent,
    "--kd-group-fill": accentAlpha(mode === "dark" ? 10 : 8),
    "--kd-group-stroke": accentAlpha(mode === "dark" ? 38 : 30),
    "--kd-node-glow": accentAlpha(mode === "dark" ? 14 : 10),
    "--kd-sequence-fragment-fill": accentAlpha(mode === "dark" ? 6 : 4),
    "--kd-sequence-fragment-stroke": accentAlpha(mode === "dark" ? 28 : 22),
  };
}

export function readVsCodePreviewColors(
  styles: Pick<CSSStyleDeclaration, "getPropertyValue">,
): VsCodePreviewColors {
  const read = (...names: string[]): string => {
    for (const name of names) {
      const value = styles.getPropertyValue(name).trim();
      if (value) return value;
    }
    return "";
  };

  return {
    accent: read(
      "--vscode-focusBorder",
      "--vscode-button-background",
      "--vscode-textLink-foreground",
    ),
    background: read("--vscode-editor-background"),
    foreground: read("--vscode-editor-foreground"),
    muted: read("--vscode-descriptionForeground", "--vscode-disabledForeground"),
    border: read("--vscode-panel-border", "--vscode-widget-border", "--vscode-editorWidget-border"),
    surface: read(
      "--vscode-sideBar-background",
      "--vscode-editorWidget-background",
      "--vscode-editor-background",
    ),
  };
}

/** Register/update the live preview theme from the current webview workbench colors. */
export function syncVsCodePreviewTheme(
  documentRef: Pick<Document, "body"> = document,
): "dark" | "light" {
  const mode = resolveVsCodeBodyMode(documentRef.body.className);
  const colors = readVsCodePreviewColors(getComputedStyle(documentRef.body));
  registerTheme(VSCODE_PREVIEW_THEME, buildVsCodePreviewTokens(mode, colors));
  return mode;
}
