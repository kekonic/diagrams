import { adaptIconBodyColors } from "./adapt-colors.ts";
import { resolveIconPaint } from "./paint.ts";
import { resolveIcon } from "./resolve.ts";
import { iconDisplaySize } from "./size.ts";
import type { IconPaintMode, IconRenderOptions, ResolvedIcon } from "./types.ts";

/** Icon ink: explicit --icon-color, else node stroke / theme fallback. */
const ICON_COLOR = "var(--icon-color, var(--node-stroke, var(--kd-node-stroke)))";

/**
 * Emit an SVG fragment positioned at (cx, cy) for a resolved icon.
 * Uses nested `<svg>` so Iconify viewBoxes scale cleanly.
 *
 * Brand paint (default): keep embedded fills (logos / simple-icons).
 * Theme paint: Lucide/builtins use `currentColor`; we set CSS `color` and adapt
 * near-black ink so glyphs pick up `--icon-color` or the parent node's stroke.
 */
export function renderIconSvg(
  icon: ResolvedIcon,
  cx: number,
  cy: number,
  options: IconRenderOptions = {},
): string {
  const targetHeight = options.height ?? 20;
  const { width, height } = iconDisplaySize(icon, targetHeight, {
    maxAspect: options.maxAspect,
  });
  const paint: IconPaintMode =
    options.paint ?? resolveIconPaint(icon.id, undefined, { hasIconColor: Boolean(options.color) });
  const className = options.className ?? "flow-node-icon-mark";
  const body = paint === "theme" ? adaptIconBodyColors(icon.body) : icon.body;
  const colorValue = options.color ?? (paint === "theme" ? ICON_COLOR : "");
  const colorAttrs = colorValue ? `color="${colorValue}"` : "";
  const x = cx - width / 2;
  const y = cy - height / 2;
  const colorPart = colorAttrs ? ` ${colorAttrs}` : "";
  return `<g class="${className}" transform="translate(${x}, ${y})"${colorPart}><svg width="${width}" height="${height}" viewBox="${icon.viewBox}" overflow="visible" aria-hidden="true">${body}</svg></g>`;
}

/** Resolve + render; returns empty string when the icon cannot be resolved. */
export function renderIconById(
  raw: string,
  cx: number,
  cy: number,
  options: IconRenderOptions = {},
): string {
  const icon = resolveIcon(raw);
  if (!icon) return "";
  return renderIconSvg(icon, cx, cy, {
    ...options,
    paint:
      options.paint ?? resolveIconPaint(raw, undefined, { hasIconColor: Boolean(options.color) }),
  });
}
