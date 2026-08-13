import type { GraphModel } from "../types/graph.ts";
import type { AnimationCue } from "./types.ts";

export type FlowEdgeRefs = {
  edgeId?: string;
  edgeIds?: string[];
};

/**
 * Resolve the concrete edge/message id for hop `i` of a flow cue.
 * `edgeIds` is authoritative and index-aligned with hops; lone `edgeId` only
 * covers hop 0 (single-hop convenience / auto-anim).
 */
export function flowHopEdgeId(hopIndex: number, refs: FlowEdgeRefs): string | undefined {
  if (refs.edgeIds && hopIndex < refs.edgeIds.length) return refs.edgeIds[hopIndex];
  if (hopIndex === 0) return refs.edgeId;
  return undefined;
}

/** Attach concrete sequence message ids to authored `flow` cues (in place-safe copy). */
export function bindSequenceFlowEdgeIds(graph: GraphModel, cues: AnimationCue[]): AnimationCue[] {
  const seq = graph.sequence;
  if (!seq) return cues;

  const messages = seq.messages
    .filter((m) => m.from && m.to && m.kind !== "destroy")
    .slice()
    .sort((a, b) => a.order - b.order);
  const used = new Set<string>();

  const take = (from: string, to: string): string | undefined => {
    for (const m of messages) {
      if (used.has(m.id) || m.from !== from || m.to !== to) continue;
      used.add(m.id);
      return m.id;
    }
    return undefined;
  };

  const mapCue = (cue: AnimationCue): AnimationCue => {
    if (cue.op === "parallel") return { ...cue, cues: cue.cues.map(mapCue) };
    if (cue.op !== "flow") return cue;
    // Explicit / auto-bound ids win — don't rebind.
    if (cue.edgeId || (cue.edgeIds && cue.edgeIds.length > 0)) return cue;
    if (cue.path.length < 2) return cue;

    const hops = cue.path.length - 1;
    const edgeIds: string[] = [];
    for (let i = 0; i < hops; i++) {
      const id = take(cue.path[i]!, cue.path[i + 1]!);
      if (!id) return cue; // incomplete bind — leave cue unbound
      edgeIds.push(id);
    }
    return { ...cue, edgeId: edgeIds[0], edgeIds };
  };

  return cues.map(mapCue);
}
