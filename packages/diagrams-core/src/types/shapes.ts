/**
 * Shared shape id vocabulary — leaf types used by kinds, compile, and geometry.
 * Geometry implementations live in @kekonic/diagrams-geometry; this module
 * only names the ids so core can validate without depending on renderers.
 */

export const BUILTIN_SHAPE_IDS = [
  "rectangle",
  "rounded",
  "pill",
  "circle",
  "ellipse",
  "diamond",
  "hexagon",
  "triangle",
  "parallelogram",
  "trapezoid",
  "document",
  "folded-document",
  "cylinder",
  "cloud",
  "person",
  "queue",
  "stream",
  "table",
  "boundary",
] as const;

export type BuiltinShapeId = (typeof BUILTIN_SHAPE_IDS)[number];

/**
 * Open shape id — built-ins plus custom registry ids.
 * Prefer this over a closed union so `registerShape()` can extend the set.
 */
export type ShapeId = BuiltinShapeId | (string & {});

const SHAPE_ALIASES: Record<string, string> = {
  note: "folded-document",
  card: "rounded",
  round: "rounded",
  roundedbox: "rounded",
  rect: "rectangle",
  box: "rectangle",
  cyl: "cylinder",
  hex: "hexagon",
  diam: "diamond",
  capsule: "pill",
  stadium: "pill",
  pipe: "queue",
  log: "stream",
};

export function normalizeShapeId(shape: string | undefined | null): string {
  if (!shape) return "rounded";
  const key = String(shape).trim().toLowerCase();
  if (!key) return "rounded";
  return SHAPE_ALIASES[key] ?? key;
}

export function isKnownShapeId(shape: string | undefined | null): boolean {
  if (!shape) return false;
  const id = normalizeShapeId(shape);
  return (BUILTIN_SHAPE_IDS as readonly string[]).includes(id);
}

export function listBuiltinShapeIds(): readonly string[] {
  return BUILTIN_SHAPE_IDS;
}

/** Shapes allowed as group chrome silhouettes (v1). */
export const GROUP_CHROME_SHAPE_IDS = [
  "rectangle",
  "rounded",
  "hexagon",
  "circle",
  "ellipse",
] as const;

export type GroupChromeShapeId = (typeof GROUP_CHROME_SHAPE_IDS)[number];

const GROUP_SHAPE_ALIASES: Record<string, string> = {
  hex: "hexagon",
  /** On groups, `round` means circle chrome (nodes map `round` → rounded). */
  round: "circle",
  rect: "rectangle",
  box: "rectangle",
};

/**
 * Normalize an authored group `shape:` value.
 * Reuses node shape ids with a small group-specific alias table.
 */
export function normalizeGroupChromeShapeId(shape: string | undefined | null): string {
  if (!shape) return "rectangle";
  const key = String(shape).trim().toLowerCase();
  if (!key) return "rectangle";
  if (GROUP_SHAPE_ALIASES[key]) return GROUP_SHAPE_ALIASES[key]!;
  return normalizeShapeId(key);
}

export function isGroupChromeShapeId(shape: string | undefined | null): boolean {
  if (!shape) return false;
  const id = normalizeGroupChromeShapeId(shape);
  return (GROUP_CHROME_SHAPE_IDS as readonly string[]).includes(id);
}

export function listGroupChromeShapeIds(): readonly string[] {
  return GROUP_CHROME_SHAPE_IDS;
}
