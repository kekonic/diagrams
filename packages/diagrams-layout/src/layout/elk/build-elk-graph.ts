import type { Direction, GraphEdge, GraphModel, LayoutOptions } from "@kekonic/diagrams-core";
import type { MeasuredNode } from "../../measure/measure.ts";
import { DENSITY_GAP, DEFAULT_GROUP_GAP, LAYOUT_MARGIN } from "../constants.ts";
import { paddingForGroup } from "../group-bounds.ts";
import { analyzeDiagramTopology } from "../../topology/analyze.ts";
import type { ElkGraph, ElkNode } from "./elk-engine.ts";
import { elkPriorityOptionsForEdge } from "./edge-priority.ts";
import { assignEdgePorts } from "./elk-ports.ts";
import { MIN_EDGE_NODE_CLEARANCE } from "./polish-edges.ts";

/** Defaults chosen for flowchart readability — override via LayoutOptions. */
const DEFAULT_NODE_PLACEMENT = "balanced";

const ELK_NODE_PLACEMENT: Record<
  NonNullable<LayoutOptions["nodePlacement"]>,
  "BRANDES_KOEPF" | "NETWORK_SIMPLEX" | "SIMPLE"
> = {
  straight: "BRANDES_KOEPF",
  balanced: "NETWORK_SIMPLEX",
  basic: "SIMPLE",
};
const DEFAULT_THOROUGHNESS = 24;

function elkDirection(direction: Direction): string {
  switch (direction) {
    case "RL":
      return "LEFT";
    case "TD":
      return "DOWN";
    case "BT":
      return "UP";
    case "LR":
    default:
      return "RIGHT";
  }
}

function spacing(options: LayoutOptions): number {
  const density = options.density ?? "normal";
  const scale = options.spacingScale ?? 1;
  const gap = DENSITY_GAP[density] ?? DENSITY_GAP.normal;
  return Math.round(gap * scale);
}

function aspectRatioFor(direction: Direction): string {
  return direction === "TD" || direction === "BT" ? "0.72" : "1.55";
}

/** Resolve ELK edge endpoint ref (node id or `node:…:edge`) to owning node id. */
export function endpointNodeId(ref: string): string {
  const colon = ref.indexOf(":");
  if (colon <= 0) return ref;
  return ref.slice(0, colon);
}

/**
 * Build an ELK JSON graph from Kekonic Diagrams measure + membership.
 * Maps semantic GraphModel → ELK; no raw elk bags on Graph JSON.
 *
 * Every edge is wired port→port: source on the flow-exit face, target on the
 * flow-entry face, with per-edge FIXED_POS pins from ShapeGeometry so fan-in
 * and fan-out never share a single attach point.
 */
export function buildElkGraph(
  graph: GraphModel,
  measured: MeasuredNode[],
  options: LayoutOptions,
): ElkGraph {
  const measureMap = new Map(measured.map((m) => [m.nodeId, m]));
  const gap = spacing(options);
  const groupGap = options.groupGap ?? DEFAULT_GROUP_GAP;
  const direction = options.direction ?? "LR";
  // Never allow flush-to-card bends — tight presets still need a stub for arrows.
  const edgeNode = Math.max(
    MIN_EDGE_NODE_CLEARANCE,
    options.edgeNodeSpacing ?? Math.round(gap * 0.6),
  );
  const edgeEdge = Math.max(12, options.edgeEdgeSpacing ?? Math.max(18, Math.round(gap * 0.36)));
  // When the studio/DSL sets groupGap, treat it as an absolute spacing override
  // (otherwise Tight can never beat comfortable density).
  const nodeNode = options.groupGap != null ? groupGap : gap;
  const layerGap = options.groupGap != null ? Math.round(groupGap * 0.9) : gap;
  const nodePlacement =
    ELK_NODE_PLACEMENT[options.nodePlacement ?? DEFAULT_NODE_PLACEMENT] ??
    ELK_NODE_PLACEMENT.straight;

  const topology = analyzeDiagramTopology(graph, direction);
  const portAssignment = assignEdgePorts(graph, measured, direction);

  const topSwimlanes = graph.groups.filter((g) => g.kind === "swimlane" && g.parentId == null);
  const usePartitions = options.groupLayout === "swimlane" || topSwimlanes.length > 0;
  // Flat = membership boxes only (no compound ELK nesting). Cross-group edges stay much
  // straighter; INCLUDE_CHILDREN compounds invent vertical channel buses in the corridor.
  const flatMembership =
    options.groupLayout === "flat" || (usePartitions && options.groupLayout === "swimlane");
  const hierarchy = flatMembership ? "SEPARATE_CHILDREN" : "INCLUDE_CHILDREN";

  const swimlanePartition = new Map<string, number>();
  topSwimlanes.forEach((g, i) => {
    for (const nodeId of g.nodeIds) swimlanePartition.set(nodeId, i);
    const stack = [...g.childGroupIds];
    while (stack.length) {
      const cid = stack.pop()!;
      const child = graph.groups.find((x) => x.id === cid);
      if (!child) continue;
      for (const nodeId of child.nodeIds) swimlanePartition.set(nodeId, i);
      stack.push(...child.childGroupIds);
    }
  });
  const defaultPartition = topSwimlanes.length;

  const incoming = topology.incoming;
  const outgoing = topology.outgoing;

  const rootLayoutOptions: Record<string, string> = {
    "elk.algorithm": "layered",
    "elk.direction": elkDirection(direction),
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.hierarchyHandling": hierarchy,
    "elk.aspectRatio": aspectRatioFor(direction),
    "elk.layered.thoroughness": String(DEFAULT_THOROUGHNESS),
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.nodePlacement.strategy": nodePlacement,
    "elk.layered.nodePlacement.bk.edgeStraightening": "IMPROVE_STRAIGHTNESS",
    "elk.layered.nodePlacement.favorStraightEdges": "true",
    "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
    // false = only real turns (true *adds* dummy bend points — see ELK docs).
    "elk.layered.unnecessaryBendpoints": "false",
    // false (ELK default): reverse edges stay in the layer corridor when possible.
    // true forces feedback edges to route *around* the diagram (long A↔B loops).
    "elk.layered.feedbackEdges": "false",
    "elk.layered.considerModelOrder.strategy":
      options.considerModelOrder === false ? "NONE" : "NODES_AND_EDGES",
    // Do not attach edge labels to ELK — KDiagram places them after layout.
    // ELK inline labels create rectangular "pockets" on otherwise straight edges.
    "elk.padding": `[top=${LAYOUT_MARGIN},left=${LAYOUT_MARGIN},bottom=${LAYOUT_MARGIN},right=${LAYOUT_MARGIN}]`,
    "elk.spacing.nodeNode": String(nodeNode),
    "elk.layered.spacing.nodeNodeBetweenLayers": String(layerGap),
    "elk.spacing.edgeNode": String(edgeNode),
    "elk.layered.spacing.edgeNodeBetweenLayers": String(edgeNode),
    "elk.spacing.edgeEdge": String(edgeEdge),
    "elk.layered.spacing.edgeEdgeBetweenLayers": String(edgeEdge),
    "elk.spacing.componentComponent": String(groupGap),
  };

  if (usePartitions) {
    rootLayoutOptions["elk.partitioning.activate"] = "true";
  }

  const crossGroupEdges = graph.edges.some((e) => {
    const a = graph.nodes.find((n) => n.id === e.from)?.groupId;
    const b = graph.nodes.find((n) => n.id === e.to)?.groupId;
    return a !== b;
  });
  if (crossGroupEdges && !flatMembership) {
    rootLayoutOptions["elk.layered.mergeHierarchyEdges"] = "true";
  }

  const groupsByParent = new Map<string | undefined, typeof graph.groups>();
  for (const g of graph.groups) {
    // Flat / swimlane: do not nest compound ELK nodes; membership boxes are painted later.
    if (flatMembership) continue;
    const key = g.parentId;
    const list = groupsByParent.get(key) ?? [];
    list.push(g);
    groupsByParent.set(key, list);
  }

  const assignedNodes = new Set<string>();

  const nodeLayoutOptions = (nodeId: string): Record<string, string> => {
    const opts: Record<string, string> = {};
    const out = outgoing.get(nodeId) ?? 0;
    const inn = incoming.get(nodeId) ?? 0;
    if (out === 0 && inn > 0) opts["elk.layered.layering.layerConstraint"] = "LAST";
    if (inn === 0 && out > 0) opts["elk.layered.layering.layerConstraint"] = "FIRST";
    if (portAssignment.portedNodes.has(nodeId)) opts["elk.portConstraints"] = "FIXED_POS";
    if (usePartitions) {
      opts["elk.partitioning.partition"] = String(
        swimlanePartition.get(nodeId) ?? defaultPartition,
      );
    }
    return opts;
  };

  const buildLeaf = (nodeId: string, m: MeasuredNode): ElkNode => {
    const layoutOptions = nodeLayoutOptions(nodeId);
    const ports = portAssignment.portsByNode.get(nodeId);
    return {
      id: nodeId,
      width: m.width,
      height: m.height,
      ...(Object.keys(layoutOptions).length ? { layoutOptions } : {}),
      ...(ports?.length ? { ports } : {}),
    };
  };

  const buildGroupNode = (groupId: string): ElkNode => {
    const group = graph.groups.find((g) => g.id === groupId)!;
    const pad = paddingForGroup(group);
    const children: ElkNode[] = [];

    for (const nodeId of group.nodeIds) {
      const m = measureMap.get(nodeId);
      if (!m) continue;
      assignedNodes.add(nodeId);
      children.push(buildLeaf(nodeId, m));
    }

    for (const child of groupsByParent.get(groupId) ?? []) {
      children.push(buildGroupNode(child.id));
    }

    return {
      id: `group:${group.id}`,
      children,
      labels: group.label
        ? [{ id: `group:${group.id}:label`, text: group.label, width: 80, height: 18 }]
        : undefined,
      layoutOptions: {
        "elk.padding": `[top=${pad.top},left=${pad.left},bottom=${pad.bottom},right=${pad.right}]`,
        "elk.spacing.nodeNode": String(Math.round(gap * 0.8)),
        "elk.layered.spacing.nodeNodeBetweenLayers": String(Math.round(gap * 0.8)),
        "elk.layered.nodePlacement.strategy": nodePlacement,
        "elk.layered.nodePlacement.favorStraightEdges": "true",
        "elk.contentAlignment": "V_CENTER H_CENTER",
      },
    };
  };

  const children: ElkNode[] = [];

  for (const top of groupsByParent.get(undefined) ?? []) {
    children.push(buildGroupNode(top.id));
  }

  for (const node of graph.nodes) {
    if (assignedNodes.has(node.id)) continue;
    const m = measureMap.get(node.id);
    if (!m) continue;
    children.push(buildLeaf(node.id, m));
  }

  const sourceRef = (edge: GraphEdge): string =>
    portAssignment.edgeSourcePort.get(edge.id) ?? edge.from;

  const targetRef = (edge: GraphEdge): string =>
    portAssignment.edgeTargetPort.get(edge.id) ?? edge.to;

  const edges = graph.edges.map((e) => ({
    id: e.id,
    sources: [sourceRef(e)],
    targets: [targetRef(e)],
    layoutOptions: elkPriorityOptionsForEdge(e),
  }));

  return {
    id: "root",
    layoutOptions: rootLayoutOptions,
    children,
    edges,
  };
}
