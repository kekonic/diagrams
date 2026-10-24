import type { EdgeKind } from "@kekonic/diagrams-core";

/** Filled when the sender waits. Open when it does not — the same rule as a sequence. */
export type FlowArrowHead = "filled" | "open";

export function flowArrowHead(kind: EdgeKind | undefined): FlowArrowHead {
  if (kind === "async" || kind === "eventual") return "open";
  return "filled";
}

export function flowArrowMarkerId(kind: EdgeKind | undefined, end: "start" | "end"): string {
  if (flowArrowHead(kind) === "open") {
    return end === "start" ? "flow-arrow-open-start" : "flow-arrow-open";
  }
  return end === "start" ? "flow-arrow-start" : "flow-arrow";
}

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
