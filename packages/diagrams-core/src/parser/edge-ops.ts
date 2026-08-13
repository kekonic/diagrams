/** Edge operators — longest first so `<->` / `<..` / `<~` / `-->` win over shorter prefixes. */
export const EDGE_OPS = [
  "<->",
  "<..",
  "<~",
  "<=",
  "<-",
  "x-",
  "=>",
  "~>",
  "..>",
  "-->",
  "-x",
  "->",
  "--",
] as const;

export type EdgeOperator = (typeof EDGE_OPS)[number];

/** Escape for TextMate / Shiki character classes (e.g. `.` in `..>`). */
export function edgeOpsPattern(): string {
  return EDGE_OPS.map((op) => op.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}
