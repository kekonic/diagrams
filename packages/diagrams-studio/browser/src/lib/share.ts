import { strictHex } from "./color.ts";
import {
  seedsForPreset,
  THEME_PRESETS,
  type ThemePresetId,
  type ThemeSeeds,
} from "./deriveTheme.ts";

const MAX_SHARED_SOURCE_BYTES = 200_000;

export type EmbedFrameStyle = "explorer" | "quiet" | "ambient";

/** Presentation carried in a Studio URL fragment. Absent on older links. */
export type LaunchLook = {
  style?: EmbedFrameStyle;
  /** `auto` means the host page owns light and dark. */
  mode?: "dark" | "light" | "auto";
  background?: "transparent" | "canvas" | "white";
  /** Set when the link locks a palette. Omitted when the host should follow its own theme. */
  preset?: ThemePresetId;
  seeds?: ThemeSeeds;
};

export type StudioLaunch = {
  source?: string;
  embed: boolean;
  look?: LaunchLook;
};

const FRAME_STYLES = new Set<EmbedFrameStyle>(["explorer", "quiet", "ambient"]);
const LOOK_MODES = new Set<NonNullable<LaunchLook["mode"]>>(["dark", "light", "auto"]);
const LOOK_BACKGROUNDS = new Set<NonNullable<LaunchLook["background"]>>([
  "transparent",
  "canvas",
  "white",
]);

export function readLaunchLook(params: URLSearchParams): LaunchLook | undefined {
  const styleRaw = params.get("style");
  const modeRaw = params.get("theme");
  const paletteRaw = params.get("palette");
  const backgroundRaw = params.get("bg");
  const style =
    styleRaw && FRAME_STYLES.has(styleRaw as EmbedFrameStyle)
      ? (styleRaw as EmbedFrameStyle)
      : undefined;
  const mode =
    modeRaw && LOOK_MODES.has(modeRaw as NonNullable<LaunchLook["mode"]>)
      ? (modeRaw as NonNullable<LaunchLook["mode"]>)
      : undefined;
  const background =
    backgroundRaw && LOOK_BACKGROUNDS.has(backgroundRaw as NonNullable<LaunchLook["background"]>)
      ? (backgroundRaw as NonNullable<LaunchLook["background"]>)
      : undefined;
  const preset = THEME_PRESETS.find((item) => item.id === paletteRaw)?.id;
  const accent = strictHex(params.get("accent"));
  const neutral = strictHex(params.get("neutral"));
  const lockColor = style !== "ambient" && mode !== "auto";
  const seedMode = mode === "light" || mode === "dark" ? mode : lockColor ? "dark" : undefined;

  let seeds: ThemeSeeds | undefined;
  if (lockColor && seedMode && preset) seeds = seedsForPreset(preset, seedMode);
  else if (lockColor && seedMode && accent && neutral) seeds = { mode: seedMode, accent, neutral };

  if (!style && !mode && !background && !seeds) return undefined;
  return {
    ...(style ? { style } : {}),
    ...(mode ? { mode } : {}),
    ...(background ? { background } : {}),
    ...(preset && seeds ? { preset } : {}),
    ...(seeds ? { seeds } : {}),
  };
}

export function readStudioLaunch(hash: string): StudioLaunch {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get("source");
  const look = readLaunchLook(params);
  return {
    source: encoded ? decodeStudioSource(encoded) : undefined,
    embed: params.get("embed") === "1",
    ...(look ? { look } : {}),
  };
}

export function buildStudioSourceUrl(
  source: string,
  studioUrl = "https://diagrams.kekonic.com/studio/",
  embed = false,
  extras?: Readonly<Record<string, string | undefined>>,
): string {
  const url = new URL(studioUrl);
  url.search = "";
  const params = new URLSearchParams();
  if (embed) params.set("embed", "1");
  params.set("source", encodeStudioSource(source));
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value) params.set(key, value);
    }
  }
  url.hash = params.toString();
  return url.toString();
}

export function buildIframeEmbed(source: string, studioUrl?: string): string {
  const src = escapeHtmlAttribute(buildStudioSourceUrl(source, studioUrl, true));
  return `<iframe src="${src}" title="KDiagram diagram" width="100%" height="560" loading="lazy" allow="fullscreen"></iframe>`;
}

export function buildWebComponentEmbed(source: string): string {
  const scriptSource = JSON.stringify(source).replaceAll("<", "\\u003c");
  return `<k-diagram id="k-diagram" theme="auto" height="560"></k-diagram>

<script type="module">
  import "@kekonic/diagrams-element";

  const diagram = document.querySelector("#k-diagram");
  diagram.source = ${scriptSource};
</script>`;
}

export function encodeStudioSource(source: string): string {
  const bytes = new TextEncoder().encode(source);
  if (bytes.byteLength > MAX_SHARED_SOURCE_BYTES) {
    throw new Error(
      "This diagram is too large to share in a URL. Save the .kdiagram file instead.",
    );
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeStudioSource(encoded: string): string | undefined {
  try {
    const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (bytes.byteLength > MAX_SHARED_SOURCE_BYTES) return undefined;
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}
