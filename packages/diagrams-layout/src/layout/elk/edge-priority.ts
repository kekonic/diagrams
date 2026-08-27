import type { GraphEdge } from "@kekonic/diagrams-core";
import { classifyBranch, type BranchKind } from "@kekonic/diagrams-core";

export type LayoutBranchCue = BranchKind;

export function layoutBranchCue(edge: Pick<GraphEdge, "label" | "branch">): LayoutBranchCue {
  return edge.branch ?? classifyBranch(edge.label);
}

/**
 * Prefer a straight happy-path spine; keep exception edges short instead of scenic.
 * Explicit GraphEdge.priority amplifies or dampens the cue.
 */
export function elkPriorityOptionsForEdge(edge: GraphEdge): Record<string, string> {
  const cue = layoutBranchCue(edge);
  let straightness = 3;
  let shortness = 3;
  let direction = 5;

  if (edge.kind === "failure" || cue === "no") {
    straightness = 1;
    shortness = 9;
  } else if (cue === "yes") {
    straightness = 9;
    shortness = 5;
  } else if (!edge.label) {
    // Unlabeled flow edges form the spine.
    straightness = 7;
    shortness = 4;
  }

  if (edge.priority === "high") {
    straightness += 3;
    shortness += 2;
    direction = 20;
  } else if (edge.priority === "low") {
    straightness = Math.max(0, straightness - 4);
    direction = 1;
    if (cue !== "no" && edge.kind !== "failure") {
      shortness = Math.max(1, shortness - 1);
    }
  }

  return {
    "elk.layered.priority.straightness": String(straightness),
    "elk.layered.priority.shortness": String(shortness),
    "elk.layered.priority.direction": String(direction),
  };
}
