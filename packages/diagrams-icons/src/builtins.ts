import type { ResolvedIcon } from "./types.ts";
import type { BuiltinIconName } from "./parse-icon-id.ts";

const VB = "0 0 20 20";

function stroke(body: string): Omit<ResolvedIcon, "id"> {
  return {
    body: `<g class="flow-node-icon-glyph" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.88">${body}</g>`,
    viewBox: VB,
    width: 20,
    height: 20,
    paint: "stroke",
  };
}

/** Compact stroke glyphs used by kind defaults (zero network / JSON). */
export const BUILTIN_ICONS: Record<BuiltinIconName, Omit<ResolvedIcon, "id">> = {
  database: stroke(
    `<ellipse cx="10" cy="4" rx="8" ry="3"/><path d="M2 4v12c0 1.7 3.6 3 8 3s8-1.3 8-3V4"/><path d="M2 10c0 1.7 3.6 3 8 3s8-1.3 8-3"/>`,
  ),
  queue: stroke(
    `<path d="M5 5h8a4 4 0 0 1 0 10H5a4 4 0 0 1 0-10Z"/><path d="M5 5a4 4 0 0 0 0 10"/>`,
  ),
  user: stroke(`<circle cx="10" cy="7" r="4"/><path d="M3 18c0-3.9 3.1-7 7-7s7 3.1 7 7"/>`),
  choice: stroke(`<path d="M10 3 17 10 10 17 3 10Z"/><path d="M10 7v6M7 10h6"/>`),
  success: stroke(`<path d="M6 10l3 3 6-7"/>`),
  warning: stroke(`<path d="M10 4 17 17H3Z"/><path d="M10 9v4M10 15h.01"/>`),
  gateway: stroke(`<path d="M3 10h14M10 3v14M6 6l8 8M14 6 6 14"/>`),
  event: stroke(`<path d="M5 10h10M10 5v10"/><circle cx="10" cy="10" r="7"/>`),
  server: stroke(
    `<rect x="3" y="3" width="14" height="14" rx="2"/><path d="M6 7h8M6 10h8M6 13h8"/><circle cx="15" cy="7" r="0.8" fill="currentColor" stroke="none"/>`,
  ),
  note: stroke(`<path d="M5 3h8l4 4v10H5Z"/><path d="M13 3v4h4"/>`),
  service: stroke(
    `<rect x="3" y="3" width="14" height="14" rx="3"/><path d="M6 8h8M6 11h8M6 14h5"/>`,
  ),
};

export function resolveBuiltinIcon(name: string): ResolvedIcon | null {
  const key = name.toLowerCase() as BuiltinIconName;
  const glyph = BUILTIN_ICONS[key];
  if (!glyph) return null;
  return { id: `builtin:${key}`, ...glyph };
}
