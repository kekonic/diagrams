export type { AnimationTarget, AnimationCue, AnimationDefinition } from "./types.ts";
export type { AutoWalkStep } from "./infer-auto-animation.ts";
export {
  inferAutoAnimation,
  planAutoWalk,
  enumerateAutoPaths,
  traceDeclarationPath,
} from "./infer-auto-animation.ts";
export { bindSequenceFlowEdgeIds, flowHopEdgeId } from "./bind-sequence-flow-edge-ids.ts";
export type { FlowEdgeRefs } from "./bind-sequence-flow-edge-ids.ts";

/** Slugify an authored animation name into a stable id. */
export function animationIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "animation";
}
