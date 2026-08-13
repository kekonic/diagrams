import type { GraphModel } from "@kekonic/diagrams-core";
import type { Direction } from "@kekonic/diagrams-core";
import { isVertical } from "../direction/index.ts";

export type DiagramTopology = {
  direction: Direction;
  isWorkflowTD: boolean;
  choiceNodes: string[];
  mergeNodes: string[];
  fanOutNodes: string[];
  choiceBranches: Set<string>;
  incoming: Map<string, number>;
  outgoing: Map<string, number>;
};

function buildEdgeCounts(graph: GraphModel): {
  incoming: Map<string, number>;
  outgoing: Map<string, number>;
} {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();

  for (const node of graph.nodes) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  return { incoming, outgoing };
}

export function analyzeDiagramTopology(graph: GraphModel, direction: Direction): DiagramTopology {
  const { incoming, outgoing } = buildEdgeCounts(graph);

  const choiceNodes: string[] = [];
  const choiceBranches = new Set<string>();
  for (const node of graph.nodes) {
    if (node.kind === "choice" && (outgoing.get(node.id) ?? 0) >= 2) {
      choiceNodes.push(node.id);
      choiceBranches.add(node.id);
    }
  }

  const mergeNodes: string[] = [];
  const fanOutNodes: string[] = [];
  for (const node of graph.nodes) {
    if ((incoming.get(node.id) ?? 0) >= 2) mergeNodes.push(node.id);
    if ((outgoing.get(node.id) ?? 0) >= 2) fanOutNodes.push(node.id);
  }

  const isWorkflowTD = isVertical(direction) && choiceNodes.length > 0;

  return {
    direction,
    isWorkflowTD,
    choiceNodes,
    mergeNodes,
    fanOutNodes,
    choiceBranches,
    incoming,
    outgoing,
  };
}

export function incomingCount(topology: DiagramTopology, nodeId: string): number {
  return topology.incoming.get(nodeId) ?? 0;
}

export function outgoingCount(topology: DiagramTopology, nodeId: string): number {
  return topology.outgoing.get(nodeId) ?? 0;
}

export function isChoiceBranch(topology: DiagramTopology, nodeId: string): boolean {
  return topology.choiceBranches.has(nodeId);
}
