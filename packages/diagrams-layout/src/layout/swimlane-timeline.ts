import { classifyBranch, type GraphEdge, type GraphModel } from "@kekonic/diagrams-core";

/** Prefer keeping the happy-path spine pointing with the layout direction. */
export function swimlaneForwardWeight(edge: GraphEdge): number {
  if (edge.priority === "high") return 20;
  if (edge.priority === "low") return 1;
  const cue = edge.branch ?? classifyBranch(edge.label);
  if (edge.kind === "failure" || cue === "no") return 3;
  if (cue === "yes") return 12;
  if (!edge.label) return 10;
  return 5;
}

function adjacency(graph: GraphModel, active: ReadonlySet<string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const node of graph.nodes) out.set(node.id, []);
  for (const edge of graph.edges) {
    if (!active.has(edge.id)) continue;
    const list = out.get(edge.from);
    if (list) list.push(edge.to);
  }
  return out;
}

function canReach(
  graph: GraphModel,
  active: ReadonlySet<string>,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  const adj = adjacency(graph, active);
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (next === to) return true;
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return false;
}

function longestPathRanks(graph: GraphModel, active: ReadonlySet<string>): Map<string, number> {
  const incoming = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) {
    incoming.set(node.id, 0);
    adj.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (!active.has(edge.id)) continue;
    adj.get(edge.from)?.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  const rank = new Map<string, number>();
  const queue: string[] = [];
  for (const node of graph.nodes) {
    rank.set(node.id, 0);
    if ((incoming.get(node.id) ?? 0) === 0) queue.push(node.id);
  }

  let seen = 0;
  while (queue.length) {
    const cur = queue.shift()!;
    seen += 1;
    const base = rank.get(cur) ?? 0;
    for (const next of adj.get(cur) ?? []) {
      rank.set(next, Math.max(rank.get(next) ?? 0, base + 1));
      const left = (incoming.get(next) ?? 0) - 1;
      incoming.set(next, left);
      if (left === 0) queue.push(next);
    }
  }

  if (seen !== graph.nodes.length) {
    for (const node of graph.nodes) {
      if (!rank.has(node.id)) rank.set(node.id, 0);
    }
  }
  return rank;
}

/**
 * Shared-timeline ranks for swimlanes: keep the high-priority spine, then add
 * remaining edges unless they close a cycle (rework / resubmit).
 */
export function swimlaneProcessRanks(graph: GraphModel): {
  rank: Map<string, number>;
  feedbackEdgeIds: Set<string>;
} {
  const strong = graph.edges.filter((edge) => swimlaneForwardWeight(edge) >= 10);
  const rest = graph.edges
    .filter((edge) => swimlaneForwardWeight(edge) < 10)
    .sort((a, b) => {
      const weight = swimlaneForwardWeight(b) - swimlaneForwardWeight(a);
      if (weight !== 0) return weight;
      return a.id.localeCompare(b.id);
    });

  const used = new Set((strong.length > 0 ? strong : graph.edges).map((edge) => edge.id));
  const feedbackEdgeIds = new Set<string>();

  // If the spine itself cycles, drop the cheapest cycle-closing edges.
  const spine = strong.length > 0 ? strong : graph.edges;
  const spineIds = new Set(spine.map((edge) => edge.id));
  const cheapest = [...spine].sort((a, b) => {
    const weight = swimlaneForwardWeight(a) - swimlaneForwardWeight(b);
    if (weight !== 0) return weight;
    return a.id.localeCompare(b.id);
  });
  for (const edge of cheapest) {
    if (!canReach(graph, spineIds, edge.to, edge.from)) continue;
    spineIds.delete(edge.id);
    used.delete(edge.id);
    feedbackEdgeIds.add(edge.id);
  }

  for (const edge of rest) {
    if (feedbackEdgeIds.has(edge.id)) continue;
    if (canReach(graph, used, edge.to, edge.from)) {
      feedbackEdgeIds.add(edge.id);
      continue;
    }
    used.add(edge.id);
  }

  return { rank: longestPathRanks(graph, used), feedbackEdgeIds };
}
