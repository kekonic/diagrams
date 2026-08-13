import { classifyBranch, type BranchKind } from "@kekonic/diagrams-core";

/** Semantic branch styling for edge labels and strokes. */
export type BranchSemantics = BranchKind;

/** Prefer compiled `GraphEdge.branch`; fall back to label classification. */
export function branchSemantics(label?: string, branch?: BranchKind): BranchSemantics {
  if (branch) return branch;
  return classifyBranch(label);
}

export function branchEdgeClass(semantics: BranchSemantics): string {
  if (semantics === "yes") return "flow-edge-branch-yes";
  if (semantics === "no") return "flow-edge-branch-no";
  return "";
}

export function branchLabelClass(semantics: BranchSemantics): string {
  if (semantics === "yes") return "flow-edge-label-yes";
  if (semantics === "no") return "flow-edge-label-no";
  return "";
}

export function branchStrokeColor(semantics: BranchSemantics, fallback: string): string {
  if (semantics === "yes") return "var(--kd-edge-yes)";
  if (semantics === "no") return "var(--kd-edge-no)";
  return fallback;
}
