import { parseIconId } from "./parse-icon-id.ts";
import type { IconPaintMode } from "./types.ts";

/**
 * Default paint: keep embedded brand fills.
 * Opt into `theme` (or set `iconColor`) to monochrome/tint with the diagram.
 */
export function defaultIconPaint(_prefix?: string): IconPaintMode {
  return "brand";
}

/**
 * Resolve effective paint for an icon id.
 * Author override (`theme` | `brand`) wins; `iconColor` forces theme tint;
 * otherwise brand (keep embedded fills).
 */
export function resolveIconPaint(
  rawId: string,
  override?: IconPaintMode | null,
  opts?: { hasIconColor?: boolean },
): IconPaintMode {
  if (override === "theme" || override === "brand") return override;
  if (opts?.hasIconColor) return "theme";
  const parsed = parseIconId(rawId);
  if (!parsed) return "brand";
  return defaultIconPaint(parsed.prefix);
}
