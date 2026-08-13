/** Parsed icon reference. */
export type ParsedIconId = {
  /** Collection prefix (`builtin`, `mdi`, `logos`, …). */
  prefix: string;
  /** Icon name within the collection. */
  name: string;
  /** Canonical `prefix:name`. */
  id: string;
};

/** Resolved drawable icon. */
export type ResolvedIcon = {
  id: string;
  /** Inner SVG markup (paths/groups), not a root `<svg>`. */
  body: string;
  viewBox: string;
  width: number;
  height: number;
  /**
   * `stroke` — KDiagram builtins (currentColor stroke).
   * `fill` — typical Iconify glyphs (currentColor or embedded fills).
   */
  paint: "stroke" | "fill";
};

/** How fills/strokes are applied when rendering into a themed node. */
export type IconPaintMode = "theme" | "brand";

export type IconRenderOptions = {
  /** Target glyph height in px; width follows viewBox aspect (default 20). */
  height?: number;
  /** Max width as a multiple of height (default 1.75). */
  maxAspect?: number;
  /** Paint policy override; otherwise derived from collection / iconColor. */
  paint?: IconPaintMode;
  /**
   * Explicit icon ink (CSS color). When set, theme-paints the glyph to this
   * value (or `--icon-color` cascade) without changing the node shell.
   */
  color?: string;
  /** Extra class on the outer `<g>`. */
  className?: string;
};

export type IconDisplaySize = {
  width: number;
  height: number;
};
