/**
 * Per-edge ELK ports from ShapeGeometry.
 *
 * Every non-mutual edge gets a dedicated source port and target port (never a
 * shared pin). Fan-in / fan-out distribute via getPortPosition(side, index, count)
 * on the flow entry / exit faces. Mutual A↔B pairs stay node→node so ELK can
 * free-attach both shafts in the layer corridor (FIXED_POS on reverse traffic
 * forces outside loops when model order ≠ layout order).
 *
 * FIXED_POS makes ELK plan from geometry positions; snapEdgeEndpointsToGeometry
 * then locks termini to the silhouette.
 */

import type { Direction, GraphEdge, GraphModel } from "@kekonic/diagrams-core";
import {
  normalizeShapeId,
  resolveShapeGeometry,
  type PortSide as GeometryPortSide,
} from "@kekonic/diagrams-geometry";
import type { MeasuredNode } from "../../measure/measure.ts";
import type { ElkPort } from "./elk-engine.ts";
import { layoutBranchCue } from "./edge-priority.ts";

export type ElkPortSide = "NORTH" | "SOUTH" | "EAST" | "WEST";

export type EdgePortAssignment = {
  /** Ports keyed by node id (includes both in and out). */
  portsByNode: Map<string, ElkPort[]>;
  /** Edge id → source port id (`node:out:edge`). */
  edgeSourcePort: Map<string, string>;
  /** Edge id → target port id (`node:in:edge`). */
  edgeTargetPort: Map<string, string>;
  /** Nodes that carry ports (need FIXED_POS). */
  portedNodes: Set<string>;
};

type PortSpec = {
  id: string;
  edgeId: string;
  side: ElkPortSide;
  /** Sort key within a face (branch cue + edge id). */
  rank: number;
};

export function flowExitSide(direction: Direction): ElkPortSide {
  switch (direction) {
    case "BT":
      return "NORTH";
    case "LR":
      return "EAST";
    case "RL":
      return "WEST";
    case "TD":
    default:
      return "SOUTH";
  }
}

export function flowEntrySide(direction: Direction): ElkPortSide {
  switch (direction) {
    case "BT":
      return "SOUTH";
    case "LR":
      return "WEST";
    case "RL":
      return "EAST";
    case "TD":
    default:
      return "NORTH";
  }
}

function elkSideToGeometry(side: ElkPortSide): GeometryPortSide {
  switch (side) {
    case "NORTH":
      return "north";
    case "EAST":
      return "east";
    case "WEST":
      return "west";
    case "SOUTH":
    default:
      return "south";
  }
}

export function outPortId(nodeId: string, edgeId: string): string {
  return `${nodeId}:out:${edgeId}`;
}

export function inPortId(nodeId: string, edgeId: string): string {
  return `${nodeId}:in:${edgeId}`;
}

/** Geometry-authored 1×1 FIXED_POS port centered on getPortPosition. */
export function makeGeometryPort(
  id: string,
  side: ElkPortSide,
  index: number,
  count: number,
  shapeId: string | undefined,
  width: number,
  height: number,
): ElkPort {
  const geometry = resolveShapeGeometry(normalizeShapeId(shapeId));
  const local = { x: 0, y: 0, width, height };
  const pos = geometry.getPortPosition(
    { kind: "side", side: elkSideToGeometry(side), index, count },
    local,
  );
  return {
    id,
    x: pos.x - 0.5,
    y: pos.y - 0.5,
    width: 1,
    height: 1,
    layoutOptions: {
      "elk.port.side": side,
      "elk.port.index": String(index),
    },
  };
}

function outRank(edge: GraphEdge): number {
  const cue = layoutBranchCue(edge);
  if (cue === "yes") return 0;
  if (cue === "no") return 2;
  return 1;
}

/**
 * Edges that participate in a 2-cycle (A→B and B→A).
 * These stay node→node so ELK free-attaches parallel corridor shafts.
 */
export function mutualEdgeIds(graph: GraphModel): Set<string> {
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.from === edge.to) continue;
    const hasReverse = graph.edges.some(
      (o) => o.id !== edge.id && o.from === edge.to && o.to === edge.from,
    );
    if (hasReverse) ids.add(edge.id);
  }
  return ids;
}

function materializeFacePorts(
  specs: PortSpec[],
  shapeId: string | undefined,
  width: number,
  height: number,
): ElkPort[] {
  const bySide = new Map<ElkPortSide, PortSpec[]>();
  for (const spec of specs) {
    const list = bySide.get(spec.side) ?? [];
    list.push(spec);
    bySide.set(spec.side, list);
  }
  const ports: ElkPort[] = [];
  for (const [side, list] of bySide) {
    list.sort((a, b) => a.rank - b.rank || a.edgeId.localeCompare(b.edgeId));
    const count = list.length;
    list.forEach((spec, index) => {
      ports.push(makeGeometryPort(spec.id, side, index, count, shapeId, width, height));
    });
  }
  return ports;
}

/**
 * Assign one out-port and one in-port per non-mutual edge.
 * Positions are distributed per face so N edges on a face ⇒ N distinct pins.
 */
export function assignEdgePorts(
  graph: GraphModel,
  measured: MeasuredNode[],
  direction: Direction,
): EdgePortAssignment {
  const measureMap = new Map(measured.map((m) => [m.nodeId, m]));
  const shapeByNode = new Map(graph.nodes.map((n) => [n.id, n.shape]));
  const exit = flowExitSide(direction);
  const entry = flowEntrySide(direction);
  const mutual = mutualEdgeIds(graph);

  const outSpecsByNode = new Map<string, PortSpec[]>();
  const inSpecsByNode = new Map<string, PortSpec[]>();
  const edgeSourcePort = new Map<string, string>();
  const edgeTargetPort = new Map<string, string>();

  const push = (map: Map<string, PortSpec[]>, nodeId: string, spec: PortSpec) => {
    const list = map.get(nodeId) ?? [];
    list.push(spec);
    map.set(nodeId, list);
  };

  for (const edge of graph.edges) {
    // Mutual pairs: leave node→node so ELK can place both shafts in-corridor.
    if (mutual.has(edge.id)) continue;

    const sourceId = outPortId(edge.from, edge.id);
    const targetId = inPortId(edge.to, edge.id);
    edgeSourcePort.set(edge.id, sourceId);
    edgeTargetPort.set(edge.id, targetId);

    push(outSpecsByNode, edge.from, {
      id: sourceId,
      edgeId: edge.id,
      side: exit,
      rank: outRank(edge),
    });
    push(inSpecsByNode, edge.to, {
      id: targetId,
      edgeId: edge.id,
      side: entry,
      rank: 1,
    });
  }

  const portsByNode = new Map<string, ElkPort[]>();
  const portedNodes = new Set<string>();

  for (const node of graph.nodes) {
    const m = measureMap.get(node.id);
    if (!m) continue;
    const outs = outSpecsByNode.get(node.id) ?? [];
    const inns = inSpecsByNode.get(node.id) ?? [];
    if (!outs.length && !inns.length) continue;
    portedNodes.add(node.id);
    const shapeId = shapeByNode.get(node.id);
    portsByNode.set(node.id, [
      ...materializeFacePorts(outs, shapeId, m.width, m.height),
      ...materializeFacePorts(inns, shapeId, m.width, m.height),
    ]);
  }

  return { portsByNode, edgeSourcePort, edgeTargetPort, portedNodes };
}
