import type { EdgeKind } from "@kekonic/diagrams-core";

/**
 * Shaft pattern for a flow edge.
 * Sequence async stays solid because that surface reserves a dash for the reply.
 * Keep these values aligned with `.flow-edge-async`, `.flow-edge-eventual`, and
 * `.flow-edge-dependency` in the theme stylesheet.
 */
export function flowEdgeDasharray(kind: EdgeKind | undefined): string | undefined {
  switch (kind) {
    case "async":
      return "6 4";
    case "eventual":
      return "2 6";
    case "dependency":
      return "2 4";
    default:
      return undefined;
  }
}
