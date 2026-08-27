import type { GraphModel, LayoutOptions, Point, Rect } from "@kekonic/diagrams-core";
import type { MeasuredNode } from "../../measure/measure.ts";
import { computeGroupBounds, measureGroupLabelBox, paddingForGroup } from "../group-bounds.ts";
import {
  applySwimlaneBands,
  hasTopLevelSwimlanes,
  resolveSwimlaneLayoutOptions,
} from "../swimlane-bands.ts";
import type {
  LaidOutGroup,
  LaidOutNode,
  LayoutEdgeLabel,
  LayoutEdgePath,
  LayoutResult,
} from "../types.ts";
import { buildElkGraph, endpointNodeId } from "./build-elk-graph.ts";
import {
  ELK_LAYOUT_ALGORITHM,
  ELK_ROUTER_ALGORITHM,
  getElk,
  type ElkEdge,
  type ElkGraph,
  type ElkNode,
} from "./elk-engine.ts";
import { snapEdgeEndpointsToGeometry } from "../attach-endpoints.ts";
import { polishEdgePaths, MIN_EDGE_NODE_CLEARANCE } from "./polish-edges.ts";
import { layoutAndRouteArranged, needsRegionArrange } from "./layout-arranged.ts";
import { isSequenceGraph, layoutSequence } from "../sequence/layout-sequence.ts";
import { routeOrthogonalAvoiding } from "../route-orthogonal-avoid.ts";

export type { LayoutEdgePath };

export type ElkLayoutAndRouteResult = {
  layout: LayoutResult;
  /** Same as `layout.edgePaths`. */
  edges: LayoutEdgePath[];
  routerAlgorithm: string;
};

type ElkNodeIndex = {
  bounds: Rect;
  parentId: string | null;
};

function collectAbsoluteNodes(
  node: ElkNode,
  offsetX: number,
  offsetY: number,
  parentId: string | null,
  boundsOut: Map<string, Rect>,
  index: Map<string, ElkNodeIndex>,
): void {
  const x = offsetX + (node.x ?? 0);
  const y = offsetY + (node.y ?? 0);
  const bounds = {
    x,
    y,
    width: node.width ?? 0,
    height: node.height ?? 0,
  };
  index.set(node.id, { bounds, parentId });
  if (node.id !== "root") {
    boundsOut.set(node.id, bounds);
  }
  for (const child of node.children ?? []) {
    collectAbsoluteNodes(child, x, y, node.id, boundsOut, index);
  }
}

/**
 * With INCLUDE_CHILDREN, ELK may list edges on the root while section/label
 * coordinates stay relative to the LCA of the endpoints (often a compound group).
 * Offset by that LCA's absolute origin — not the edges-array owner.
 */
function edgeCoordinateOrigin(
  index: Map<string, ElkNodeIndex>,
  sourceId: string | undefined,
  targetId: string | undefined,
): Point {
  if (!sourceId || !targetId) return { x: 0, y: 0 };

  const sourceNode = endpointNodeId(sourceId);
  const targetNode = endpointNodeId(targetId);

  const ancestors = new Set<string>();
  let cur: string | null = sourceNode;
  while (cur) {
    ancestors.add(cur);
    cur = index.get(cur)?.parentId ?? null;
  }

  cur = targetNode;
  while (cur) {
    if (ancestors.has(cur)) {
      const hit = index.get(cur);
      return hit ? { x: hit.bounds.x, y: hit.bounds.y } : { x: 0, y: 0 };
    }
    cur = index.get(cur)?.parentId ?? null;
  }

  return { x: 0, y: 0 };
}

function collectAbsoluteEdges(
  node: ElkNode,
  index: Map<string, ElkNodeIndex>,
  paths: LayoutEdgePath[],
  labels: LayoutEdgeLabel[],
  seen: Set<string>,
): void {
  for (const edge of node.edges ?? []) {
    if (seen.has(edge.id)) continue;
    seen.add(edge.id);

    const origin = edgeCoordinateOrigin(index, edge.sources?.[0], edge.targets?.[0]);
    const points = edgePoints(edge, origin.x, origin.y);
    if (points.length >= 2) paths.push({ edgeId: edge.id, points });

    for (const label of edge.labels ?? []) {
      if (label.x == null || label.y == null || !label.width || !label.height) continue;
      const bounds = {
        x: origin.x + label.x,
        y: origin.y + label.y,
        width: label.width,
        height: label.height,
      };
      labels.push({
        edgeId: edge.id,
        text: label.text,
        bounds,
        anchor: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
      });
    }
  }
  for (const child of node.children ?? []) {
    collectAbsoluteEdges(child, index, paths, labels, seen);
  }
}

function edgePoints(edge: ElkEdge, offsetX: number, offsetY: number): Point[] {
  const points: Point[] = [];
  for (const section of edge.sections ?? []) {
    points.push({ x: section.startPoint.x + offsetX, y: section.startPoint.y + offsetY });
    for (const bend of section.bendPoints ?? []) {
      points.push({ x: bend.x + offsetX, y: bend.y + offsetY });
    }
    points.push({ x: section.endPoint.x + offsetX, y: section.endPoint.y + offsetY });
  }
  return dedupePoints(points);
}

function dedupePoints(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x - p.x) < 0.5 && Math.abs(prev.y - p.y) < 0.5) continue;
    out.push(p);
  }
  return out;
}

function fanSlot(index: number, count: number): number {
  if (count <= 1) return 0.5;
  return 0.28 + (0.44 * index) / (count - 1);
}

/** Route after swimlane Y-pack. Lane chrome is not an obstacle — edges may cross empty band space. */
function routeLaidOutEdges(
  graph: GraphModel,
  nodes: LaidOutNode[],
  options: LayoutOptions,
): LayoutEdgePath[] {
  const bounds = new Map(nodes.map((node) => [node.nodeId, node.bounds]));
  const routed = graph.edges.filter((edge) => bounds.has(edge.from) && bounds.has(edge.to));
  const tFrom = new Map<string, number>();
  const tTo = new Map<string, number>();
  const byFrom = new Map<string, typeof routed>();
  const byTo = new Map<string, typeof routed>();
  for (const edge of routed) {
    const fromList = byFrom.get(edge.from) ?? [];
    fromList.push(edge);
    byFrom.set(edge.from, fromList);
    const toList = byTo.get(edge.to) ?? [];
    toList.push(edge);
    byTo.set(edge.to, toList);
  }
  for (const list of byFrom.values()) {
    list.sort(
      (a, b) =>
        bounds.get(a.to)!.x +
          bounds.get(a.to)!.width / 2 -
          (bounds.get(b.to)!.x + bounds.get(b.to)!.width / 2) ||
        bounds.get(a.to)!.y - bounds.get(b.to)!.y,
    );
    list.forEach((edge, index) => tFrom.set(edge.id, fanSlot(index, list.length)));
  }
  for (const list of byTo.values()) {
    list.sort(
      (a, b) =>
        bounds.get(a.from)!.x +
          bounds.get(a.from)!.width / 2 -
          (bounds.get(b.from)!.x + bounds.get(b.from)!.width / 2) ||
        bounds.get(a.from)!.y - bounds.get(b.from)!.y,
    );
    list.forEach((edge, index) => tTo.set(edge.id, fanSlot(index, list.length)));
  }

  const clearance = Math.max(
    MIN_EDGE_NODE_CLEARANCE,
    options.edgeNodeSpacing ?? MIN_EDGE_NODE_CLEARANCE,
  );
  const avoidPad = Math.min(12, clearance);
  const paths: LayoutEdgePath[] = [];
  for (const edge of routed) {
    const from = bounds.get(edge.from)!;
    const to = bounds.get(edge.to)!;
    const obstacles: Rect[] = [];
    for (const [id, box] of bounds) {
      if (id === edge.from || id === edge.to) continue;
      obstacles.push(box);
    }
    const points = routeOrthogonalAvoiding(
      from,
      to,
      obstacles,
      avoidPad,
      tFrom.get(edge.id) ?? 0.5,
      tTo.get(edge.id) ?? 0.5,
    );
    if (points.length >= 2) paths.push({ edgeId: edge.id, points });
  }
  return paths;
}

function ranksFromBounds(
  nodes: Array<{ nodeId: string; bounds: Rect }>,
  direction: LayoutOptions["direction"],
): LaidOutNode[] {
  const dir = direction ?? "LR";
  const horizontal = dir === "LR" || dir === "RL";
  const sorted = [...nodes].sort((a, b) => {
    const aPrimary = horizontal ? a.bounds.x : a.bounds.y;
    const bPrimary = horizontal ? b.bounds.x : b.bounds.y;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    const aSecondary = horizontal ? a.bounds.y : a.bounds.x;
    const bSecondary = horizontal ? b.bounds.y : b.bounds.x;
    return aSecondary - bSecondary;
  });

  const rankOf = new Map<string, number>();
  let rank = 0;
  let lastPrimary = Number.NEGATIVE_INFINITY;
  for (const n of sorted) {
    const primary = horizontal ? n.bounds.x : n.bounds.y;
    if (primary - lastPrimary > 8) {
      if (lastPrimary !== Number.NEGATIVE_INFINITY) rank += 1;
      lastPrimary = primary;
    }
    rankOf.set(n.nodeId, rank);
  }

  const orderInRank = new Map<number, number>();
  return sorted.map((n) => {
    const r = rankOf.get(n.nodeId) ?? 0;
    const order = orderInRank.get(r) ?? 0;
    orderInRank.set(r, order + 1);
    return {
      nodeId: n.nodeId,
      bounds: n.bounds,
      rank: r,
      order,
    };
  });
}

function groupsFromElk(
  graph: GraphModel,
  absolute: Map<string, Rect>,
  laidOutNodes: LaidOutNode[],
): LaidOutGroup[] {
  const fallback = computeGroupBounds(graph, laidOutNodes);
  const byId = new Map(fallback.map((g) => [g.groupId, g]));

  for (const group of graph.groups) {
    const elkBounds = absolute.get(`group:${group.id}`);
    if (!elkBounds || elkBounds.width <= 0 || elkBounds.height <= 0) continue;
    const padding = paddingForGroup(group);
    byId.set(group.id, {
      groupId: group.id,
      bounds: elkBounds,
      labelBox: measureGroupLabelBox(
        group.label,
        elkBounds,
        Boolean(group.icon && group.icon !== "none" && group.chrome !== false),
      ),
      padding,
    });
  }

  return [...byId.values()];
}

/**
 * Layout + orthogonal edge routes via ELK (elkjs API; elk-rs drop-in when published).
 */
export async function layoutAndRouteWithElk(
  graph: GraphModel,
  measured: MeasuredNode[],
  rawOptions: LayoutOptions = {},
): Promise<ElkLayoutAndRouteResult> {
  if (isSequenceGraph(graph)) {
    return layoutSequence(graph, measured, rawOptions);
  }
  if (needsRegionArrange(graph, rawOptions)) {
    return layoutAndRouteArranged(graph, measured, rawOptions);
  }

  const t0 = performance.now();
  const options = resolveSwimlaneLayoutOptions(graph, rawOptions);
  const direction = options.direction ?? "LR";
  const elkGraph = buildElkGraph(graph, measured, { ...options, direction });
  const laid: ElkGraph = await getElk().layout(elkGraph);

  const absolute = new Map<string, Rect>();
  const index = new Map<string, ElkNodeIndex>();
  collectAbsoluteNodes(laid, 0, 0, null, absolute, index);

  const nodeEntries = graph.nodes
    .map((n) => {
      const b = absolute.get(n.id);
      if (!b) return null;
      return { nodeId: n.id, bounds: b };
    })
    .filter((n): n is NonNullable<typeof n> => n != null);

  const ranked = ranksFromBounds(nodeEntries, direction);
  const banded = applySwimlaneBands(graph, ranked, groupsFromElk(graph, absolute, ranked));
  const laidOutNodes = ranksFromBounds(banded.nodes, direction);
  const groups = banded.groups;
  const shiftX = banded.shiftX;

  let rawPaths: LayoutEdgePath[] = [];
  const rawLabels: LayoutEdgeLabel[] = [];
  if (hasTopLevelSwimlanes(graph)) {
    rawPaths = routeLaidOutEdges(graph, laidOutNodes, options);
  } else {
    collectAbsoluteEdges(laid, index, rawPaths, rawLabels, new Set());
    if (shiftX !== 0) {
      for (const path of rawPaths) {
        path.points = path.points.map((point) => ({ ...point, x: point.x + shiftX }));
      }
      for (const label of rawLabels) {
        label.bounds = { ...label.bounds, x: label.bounds.x + shiftX };
        label.anchor = { ...label.anchor, x: label.anchor.x + shiftX };
      }
    }
  }
  // Authoritative visual attach: snap termini onto ShapeGeometry perimeters, then
  // polish corridors with those endpoints frozen (ERD column snap runs later).
  const attachedPaths = snapEdgeEndpointsToGeometry(graph, laidOutNodes, rawPaths);
  const edgePaths = polishEdgePaths(
    attachedPaths,
    laidOutNodes.map((n) => n.bounds),
    Math.max(MIN_EDGE_NODE_CLEARANCE, options.edgeNodeSpacing ?? MIN_EDGE_NODE_CLEARANCE),
  );
  const edgeLabels = rawLabels;

  let maxX = 0;
  let maxY = 0;
  for (const n of laidOutNodes) {
    maxX = Math.max(maxX, n.bounds.x + n.bounds.width);
    maxY = Math.max(maxY, n.bounds.y + n.bounds.height);
  }
  for (const g of groups) {
    maxX = Math.max(maxX, g.bounds.x + g.bounds.width);
    maxY = Math.max(maxY, g.bounds.y + g.bounds.height);
  }
  for (const path of edgePaths) {
    for (const p of path.points) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  for (const label of edgeLabels) {
    maxX = Math.max(maxX, label.bounds.x + label.bounds.width);
    maxY = Math.max(maxY, label.bounds.y + label.bounds.height);
  }

  const layout: LayoutResult = {
    nodes: laidOutNodes,
    groups,
    edgePaths,
    edgeLabels,
    direction,
    algorithmVersion: ELK_LAYOUT_ALGORITHM,
    layoutMs: performance.now() - t0,
    width: Math.max(maxX, laid.width ?? 0) + 8,
    height: Math.max(maxY, laid.height ?? 0) + 8,
  };

  return {
    layout,
    edges: edgePaths,
    routerAlgorithm: ELK_ROUTER_ALGORITHM,
  };
}
