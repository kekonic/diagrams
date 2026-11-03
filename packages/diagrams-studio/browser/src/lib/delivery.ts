import { strictHex } from "./color.ts";
import {
  seedsForModeToggle,
  seedsForPreset,
  THEME_PRESETS,
  type ThemePresetId,
  type ThemeSeeds,
} from "./deriveTheme.ts";
import { buildStudioSourceUrl, type EmbedFrameStyle } from "./share.ts";

export const PNG_SCALES = [1, 2, 3] as const;
export type PngScale = (typeof PNG_SCALES)[number];
export const PNG_MAX_EDGE = 8192;

export type ExportFormat = "svg" | "png";
export type ExportBackground = "transparent" | "canvas" | "white";
export type PaletteChoice = "studio" | ThemePresetId;
export type FilePresetId = "screen" | "slide" | "document" | "inline";
export type EmbedStyleId =
  | "explorer"
  | "quiet"
  | "ambient"
  | "still"
  | "component"
  | "markdown"
  | "link";
export type EmbedColorMode = "lock" | "follow";

export type FileDelivery = {
  format: ExportFormat;
  palette: PaletteChoice;
  mode: "dark" | "light";
  background: ExportBackground;
  /** When false, SVG keeps unresolved theme variables for a host page. PNG always snapshots. */
  portable: boolean;
  embedFonts: boolean;
  scale: PngScale;
};

export type EmbedDelivery = {
  style: EmbedStyleId;
  color: EmbedColorMode;
};

export const FILE_PRESETS: ReadonlyArray<{ id: FilePresetId; label: string; detail: string }> = [
  {
    id: "screen",
    label: "Screen",
    detail: "SVG with a transparent ground. Colors are saved in the file.",
  },
  {
    id: "slide",
    label: "Slide",
    detail: "PNG at 2× on the palette ground, for decks and chat.",
  },
  {
    id: "document",
    label: "Document",
    detail: "Light SVG on the palette ground, with Inter embedded.",
  },
  {
    id: "inline",
    label: "Inline",
    detail: "SVG whose colors follow a host page that provides theme tokens.",
  },
];

export const EMBED_STYLES: ReadonlyArray<{ id: EmbedStyleId; label: string; detail: string }> = [
  {
    id: "explorer",
    label: "Explorer",
    detail: "Pan, zoom, views, and animation inside an iframe.",
  },
  {
    id: "quiet",
    label: "Quiet",
    detail: "A frameless iframe with zoom and no other chrome.",
  },
  {
    id: "ambient",
    label: "Ambient",
    detail: "No chrome. Colors and background follow the host page.",
  },
  {
    id: "still",
    label: "Still",
    detail: "Inline SVG for a README, email, or design tool.",
  },
  {
    id: "component",
    label: "Component",
    detail: "A k-diagram element for an app that installs the packages.",
  },
  {
    id: "markdown",
    label: "Markdown",
    detail: "A kdiagram fence. The host theme paints it.",
  },
  {
    id: "link",
    label: "Studio link",
    detail: "Opens this source in Studio. The fragment is not sent to the server.",
  },
];

export function filePresetPatch(id: FilePresetId, current: FileDelivery): FileDelivery {
  switch (id) {
    case "screen":
      return {
        ...current,
        format: "svg",
        background: "transparent",
        portable: true,
        embedFonts: false,
      };
    case "slide":
      return {
        ...current,
        format: "png",
        background: "canvas",
        portable: true,
        embedFonts: true,
        scale: 2,
      };
    case "document":
      return {
        ...current,
        format: "svg",
        mode: "light",
        background: "canvas",
        portable: true,
        embedFonts: true,
      };
    case "inline":
      return {
        ...current,
        format: "svg",
        background: "transparent",
        portable: false,
        embedFonts: false,
      };
  }
}

export function fileSettingsDetail(file: FileDelivery): string {
  const preset = matchingFilePreset(file);
  const known = FILE_PRESETS.find((item) => item.id === preset);
  if (known) return known.detail;
  const ground =
    file.background === "transparent"
      ? "a transparent ground"
      : file.background === "white"
        ? "a white ground"
        : "the palette ground";
  if (file.format === "png") {
    return `Custom. PNG at ${file.scale}× on ${ground}, with this palette and Inter saved in the file.`;
  }
  if (!file.portable) {
    return `Custom. SVG on ${ground}. Colors follow a host page that provides theme tokens.`;
  }
  return file.embedFonts
    ? `Custom. SVG on ${ground}, with this palette and Inter saved in the file.`
    : `Custom. SVG on ${ground}. Colors are saved in the file.`;
}

/** Render key for the preview. Scale is applied later, when the PNG is encoded. */
export function deliveryPreview(
  file: FileDelivery,
  destination: "file" | "embed",
  style: EmbedStyleId,
  color: EmbedColorMode,
): FileDelivery {
  const stable: FileDelivery = { ...file, scale: 1 };
  if (destination === "embed" && style === "still") {
    const locked = effectiveEmbedColor(style, color) === "lock";
    return {
      ...stable,
      format: "svg",
      portable: locked,
      embedFonts: locked && file.embedFonts,
    };
  }
  if (destination === "embed") return { ...stable, format: "svg" };
  return stable;
}

function safePreviewDeclaration(key: string, value: string): string | undefined {
  if (!/^--[a-zA-Z0-9_-]+$/.test(key) || value.length > 240) return undefined;
  if (/[<>{};]|url\s*\(|expression\s*\(|@import|\/\*|\*\/|\\/i.test(value)) return undefined;
  return `${key}:${value}`;
}

/**
 * Paint theme variables for an image preview. The returned markup is display-only:
 * a live SVG download keeps its unresolved tokens.
 */
export function withPreviewTokens(svg: string, tokens: Record<string, string>): string {
  if (svg.includes("kdiagram-preview-theme")) return svg;
  const declarations: string[] = [];
  for (const [key, value] of Object.entries(tokens)) {
    const declaration = safePreviewDeclaration(key, value);
    if (!declaration) return svg;
    declarations.push(declaration);
  }
  const rule = `/*kdiagram-preview-theme*/.k-diagram{${declarations.join(";")}}`;
  const styleIndex = svg.indexOf("<style>");
  return styleIndex >= 0
    ? svg.slice(0, styleIndex + 7) + rule + svg.slice(styleIndex + 7)
    : svg.replace(/(<svg\b[^>]*>)/, `$1<style>${rule}</style>`);
}

export function matchingFilePreset(file: FileDelivery): FilePresetId | undefined {
  const order: FilePresetId[] = ["screen", "slide", "document", "inline"];
  return order.find((id) => {
    const next = filePresetPatch(id, file);
    return (
      next.format === file.format &&
      next.background === file.background &&
      next.portable === file.portable &&
      next.embedFonts === file.embedFonts &&
      next.mode === file.mode &&
      (file.format !== "png" || next.scale === file.scale)
    );
  });
}

export function seedsForPalette(
  choice: PaletteChoice,
  mode: "dark" | "light",
  studioSeeds: ThemeSeeds,
): ThemeSeeds {
  if (choice === "studio") {
    return studioSeeds.mode === mode
      ? { ...studioSeeds, mode }
      : seedsForModeToggle(studioSeeds, mode);
  }
  return seedsForPreset(choice, mode);
}

export function matchingPreset(seeds: ThemeSeeds): ThemePresetId | undefined {
  for (const { id } of THEME_PRESETS) {
    const preset = seedsForPreset(id, seeds.mode);
    if (
      strictHex(preset.accent) === strictHex(seeds.accent) &&
      strictHex(preset.neutral) === strictHex(seeds.neutral)
    ) {
      return id;
    }
  }
  return undefined;
}

export function paletteLabel(choice: PaletteChoice): string {
  if (choice === "studio") return "Studio";
  return THEME_PRESETS.find((item) => item.id === choice)?.label ?? "Palette";
}

export function effectiveEmbedColor(style: EmbedStyleId, color: EmbedColorMode): EmbedColorMode {
  if (style === "ambient" || style === "markdown") return "follow";
  return color;
}

export function exportFilename(documentName: string, format: ExportFormat): string {
  const base = documentName.replace(/\.kdiagram$/i, "").trim() || "diagram";
  const safe = base
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
  return `${safe || "diagram"}.${format}`;
}

export function embedElementId(documentName: string): string {
  const base = documentName.replace(/\.kdiagram$/i, "");
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `kdiagram-${slug || "diagram"}`;
}

export function readSvgSize(svg: string): { width: number; height: number } | undefined {
  const open = svg.match(/<svg\b[^>]*>/);
  if (!open) return undefined;
  const width = open[0].match(/\bwidth="([\d.]+)"/);
  const height = open[0].match(/\bheight="([\d.]+)"/);
  if (!width?.[1] || !height?.[1]) return undefined;
  const w = Number(width[1]);
  const h = Number(height[1]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return undefined;
  return { width: w, height: h };
}

export function pngPixelSize(
  svg: string,
  scale: PngScale,
): { width: number; height: number } | undefined {
  const size = readSvgSize(svg);
  if (!size) return undefined;
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
}

export function pngScaleFits(svg: string, scale: PngScale): boolean {
  const pixels = pngPixelSize(svg, scale);
  if (!pixels) return true;
  return pixels.width <= PNG_MAX_EDGE && pixels.height <= PNG_MAX_EDGE;
}

const CANVAS_BACKGROUND =
  '<rect class="kdiagram-export-background" width="100%" height="100%" fill="var(--kd-bg)"/>';
const WHITE_BACKGROUND =
  '<rect class="kdiagram-export-background" width="100%" height="100%" fill="#ffffff"/>';

/** Bake a ground and an optional font face into library-rendered SVG. */
export function finishExportSvg(
  svg: string,
  options: { background: ExportBackground; fontFaceCss?: string },
): string {
  let output = svg;
  if (options.fontFaceCss) {
    if (/[<>]/.test(options.fontFaceCss)) {
      throw new Error("Embedded font CSS is not safe to inline.");
    }
    if (!output.includes("kdiagram-export-font")) {
      const css = `/*kdiagram-export-font*/${options.fontFaceCss}`;
      const styleIndex = output.indexOf("<style>");
      output =
        styleIndex >= 0
          ? output.slice(0, styleIndex + 7) + css + output.slice(styleIndex + 7)
          : output.replace(/(<svg\b[^>]*>)/, `$1\n<style>${css}</style>`);
    }
  }
  if (options.background !== "transparent" && !output.includes("kdiagram-export-background")) {
    const rect = options.background === "white" ? WHITE_BACKGROUND : CANVAS_BACKGROUND;
    output = /<desc\b[^>]*>[^<]*<\/desc>/.test(output)
      ? output.replace(/(<desc\b[^>]*>[^<]*<\/desc>)/, `$1\n${rect}`)
      : output.replace(/(<svg\b[^>]*>)/, `$1\n${rect}`);
  }
  return output;
}

export function lookParams(input: {
  style?: EmbedFrameStyle;
  color: EmbedColorMode;
  seeds?: ThemeSeeds;
  background?: ExportBackground;
}): Record<string, string> {
  const params: Record<string, string> = {};
  if (input.style) params.style = input.style;
  if (input.background) params.bg = input.background;
  if (input.color === "follow" || input.style === "ambient") {
    params.theme = "auto";
    return params;
  }
  if (!input.seeds) return params;
  params.theme = input.seeds.mode;
  const preset = matchingPreset(input.seeds);
  if (preset) {
    params.palette = preset;
    return params;
  }
  const accent = strictHex(input.seeds.accent);
  const neutral = strictHex(input.seeds.neutral);
  if (accent && neutral) {
    params.accent = accent;
    params.neutral = neutral;
  }
  return params;
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function jsString(value: string): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function markdownFence(source: string): string {
  const body = source.replace(/\n$/, "");
  const ticks = /`{3,}/.test(body) ? "````" : "```";
  return `${ticks}kdiagram\n${body}\n${ticks}`;
}

function iframeHeight(style: EmbedFrameStyle): number {
  if (style === "quiet") return 480;
  if (style === "ambient") return 420;
  return 640;
}

function frameStyle(style: EmbedStyleId): EmbedFrameStyle | undefined {
  if (style === "explorer" || style === "quiet" || style === "ambient") return style;
  return undefined;
}

export function buildIframeSnippet(
  source: string,
  studioUrl: string,
  input: {
    style: EmbedFrameStyle;
    color: EmbedColorMode;
    seeds?: ThemeSeeds;
    background: ExportBackground;
  },
): string {
  const src = escapeHtmlAttribute(
    buildStudioSourceUrl(
      source,
      studioUrl,
      true,
      lookParams({
        style: input.style,
        color: input.color,
        seeds: input.seeds,
        background: input.background,
      }),
    ),
  );
  return `<iframe src="${src}" title="Diagram" width="100%" height="${iframeHeight(input.style)}" style="border:0;background:transparent" loading="lazy" allow="fullscreen" referrerpolicy="no-referrer"></iframe>`;
}

function componentAttributes(
  style: EmbedStyleId,
  color: EmbedColorMode,
  elementId: string,
): string {
  const theme = color === "lock" ? "kekonic-export" : "auto";
  const height = style === "quiet" ? 480 : 560;
  const animation = style === "quiet" || style === "ambient" ? "false" : "true";
  const views = style === "ambient" ? "false" : "true";
  const themeToggle =
    color === "follow" && style !== "quiet" && style !== "ambient" ? "true" : "false";
  const sketchToggle = style === "quiet" || style === "ambient" ? "false" : "true";
  return [
    `id="${elementId}"`,
    `theme="${theme}"`,
    `height="${height}"`,
    "frameless",
    `show-theme-toggle="${themeToggle}"`,
    `show-sketch-toggle="${sketchToggle}"`,
    `show-view-controls="${views}"`,
    `show-view-switcher="${views}"`,
    `animation-controls="${animation}"`,
  ].join(" ");
}

function safeTokens(tokens: Record<string, string>): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (!/^--[a-zA-Z0-9_-]+$/.test(key)) return undefined;
    if (/[<>]/.test(value) || /url\s*\(/i.test(value)) return undefined;
    out[key] = value;
  }
  return out;
}

export function buildComponentSnippet(input: {
  source: string;
  documentName: string;
  color: EmbedColorMode;
  style: EmbedStyleId;
  tokens?: Record<string, string>;
}): string {
  const elementId = embedElementId(input.documentName);
  const tokens = input.color === "lock" && input.tokens ? safeTokens(input.tokens) : undefined;
  if (input.color === "lock" && !tokens) {
    throw new Error("This palette cannot be embedded in the web component snippet.");
  }
  const attrs = componentAttributes(
    input.style === "quiet" ? "quiet" : "component",
    tokens ? "lock" : "follow",
    elementId,
  );
  const tokenLiteral = tokens ? JSON.stringify(tokens, null, 2).replaceAll("<", "\\u003c") : "";
  const lines = [
    `<k-diagram ${attrs}></k-diagram>`,
    "",
    '<script type="module">',
    ...(tokens
      ? [
          '  import { registerTheme } from "@kekonic/diagrams";',
          '  import "@kekonic/diagrams-element";',
          "",
          `  registerTheme("kekonic-export", ${tokenLiteral});`,
        ]
      : ['  import "@kekonic/diagrams-element";']),
    `  const diagram = document.querySelector("#${elementId}");`,
    `  diagram.source = ${jsString(input.source)};`,
    "</script>",
  ];
  return lines.join("\n");
}

export type EmbedSnippet = {
  text: string;
  hint: string;
};

export function buildEmbedSnippet(input: {
  style: EmbedStyleId;
  color: EmbedColorMode;
  source: string;
  studioUrl: string;
  documentName: string;
  seeds?: ThemeSeeds;
  background: ExportBackground;
  svg?: string | null;
  tokens?: Record<string, string>;
}): EmbedSnippet {
  const color = effectiveEmbedColor(input.style, input.color);
  const frame = frameStyle(input.style);
  if (frame) {
    return {
      text: buildIframeSnippet(input.source, input.studioUrl, {
        style: frame,
        color,
        seeds: color === "lock" ? input.seeds : undefined,
        background: frame === "ambient" ? "transparent" : input.background,
      }),
      hint:
        frame === "ambient"
          ? "No chrome. The page background shows through, and the theme follows the host."
          : color === "lock"
            ? frame === "quiet"
              ? "Zoom stays available. The palette and other chrome stay as you set them."
              : "Readers can pan, zoom, switch views, and play animations. The palette stays locked, with a light and dark pair of the same colors."
            : "Readers can pan and zoom. Light and dark follow the host page.",
    };
  }
  if (input.style === "still") {
    if (color === "follow") {
      return {
        text: input.svg ?? "",
        hint: "Colors stay as theme variables. The page needs Kekonic Diagrams theme tokens for this SVG to pick them up.",
      };
    }
    return {
      text: input.svg ?? "",
      hint: "Colors are saved in the markup, so the diagram matches this preview in a README or design tool.",
    };
  }
  if (input.style === "component") {
    return {
      text: buildComponentSnippet({
        source: input.source,
        documentName: input.documentName,
        color,
        style: "component",
        tokens: input.tokens,
      }),
      hint:
        color === "lock"
          ? "Registers this palette on the shared theme module, then renders the element. Change the id if the page already uses it."
          : "Theme follows the page. Install @kekonic/diagrams-element in the app that hosts the snippet.",
    };
  }
  if (input.style === "markdown") {
    return {
      text: markdownFence(input.source),
      hint: "The fence is source only. Docs plugins paint it with the host theme, not this export palette.",
    };
  }
  return {
    text: buildStudioSourceUrl(
      input.source,
      input.studioUrl,
      false,
      color === "lock" ? lookParams({ color, seeds: input.seeds }) : undefined,
    ),
    hint:
      color === "lock"
        ? "Opens Studio with this source and palette. The document stays in the URL fragment."
        : "Opens Studio with this source. The recipient keeps their own palette.",
  };
}
