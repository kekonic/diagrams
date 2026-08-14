import type {
  GraphGroup,
  GraphModel,
  LayoutOptions,
  Rect,
  RegionArrange,
} from "@kekonic/diagrams-core";
import type { MeasuredNode } from "../../measure/measure.ts";
import { LAYOUT_MARGIN } from "../constants.ts";
import {
  measureGroupLabelBox,
  paddingForGroup,
  prefersSquareGroupChrome,
  squareUpBounds,
} from "../group-bounds.ts";
import type {
  LaidOutGroup,
  LaidOutNode,
  LayoutEdgeLabel,
  LayoutEdgePath,
  LayoutResult,
} from "../types.ts";
import {
  groupHasRegionArrange,
  regionArrange,
  regionArrangeSurround,
  resolveArrangeGap,
  type RegionCell,
} from "../region-arrange.ts";
import { preferredSidePair, routeOrthogonalAvoiding } from "../route-orthogonal-avoid.ts";
import { buildElkGraph } from "./build-elk-graph.ts";
import { snapEdgeEndpointsToGeometry } from "../attach-endpoints.ts";
import {
  collapseColinearPoints,
  ensureOrthogonalPoints,
  MIN_EDGE_NODE_CLEARANCE,
} from "./polish-edges.ts";
import {
  ELK_LAYOUT_ALGORITHM,
  ELK_ROUTER_ALGORITHM,
  getElk,
  type ElkEdge,
  type ElkGraph,
  type ElkNode,
} from "./elk-engine.ts";

/** Inside a row of columns, pack top→bottom; inside stacked bands, pack left→right. */
function cellFlowDirection(parentArrange: RegionArrange): NonNullable<LayoutOptions["direction"]> {
  if (parentArrange === "row") return "TD";
  if (parentArrange === "stack") return "LR";
  return "TD";
}

export type ArrangedLayoutResult = {
  layout: LayoutResult;
  edges: LayoutEdgePath[];
  routerAlgorithm: string;
};

const NODE_CELL_PREFIX = "__node__:";

/** Fallback leaf gap when no authored `gap` — roomier than the old hard-coded 16px. */
function defaultLeafGap(density?: LayoutOptions["density"]): number {
  switch (density) {
    case "compact":
      return 20;
    case "spacious":
      return 40;
    case "normal":
    default:
      return 28;
  }
}

function resolveLeafGap(gap: string | number | undefined, options: LayoutOptions): number {
  const scale = options.spacingScale ?? 1;
  const base = gap != null ? resolveArrangeGap(gap) : defaultLeafGap(options.density);
  return Math.max(0, Math.round(base * scale));
}

function resolveTrackGap(gap: string | number | undefined, options: LayoutOptions): number {
  const scale = options.spacingScale ?? 1;
  return Math.max(0, Math.round(resolveArrangeGap(gap) * scale));
}

function nodeCellId(nodeId: string): string {
  return `${NODE_CELL_PREFIX}${nodeId}`;
}

function parseNodeCellId(cellId: string): string | null {
  return cellId.startsWith(NODE_CELL_PREFIX) ? cellId.slice(NODE_CELL_PREFIX.length) : null;
}

/** Pack wrap width — wider densities keep more siblings on one row. */
function packMaxRowWidth(density?: LayoutOptions["density"]): number {
  switch (density) {
    case "compact":
      return 420;
    case "spacious":
      return 720;
    case "normal":
    default:
      return 560;
  }
}

export function needsRegionArrange(graph: GraphModel, options: LayoutOptions): boolean {
  if (
    options.arrange === "stack" ||
    options.arrange === "row" ||
    options.arrange === "grid" ||
    options.arrange === "surround"
  ) {
    return true;
  }
  return graph.groups.some((g) => groupHasRegionArrange(g));
}

function ranksFromFixed(
  nodes: LaidOutNode[],
  direction: LayoutOptions["direction"],
): LaidOutNode[] {
  const dir = direction ?? "LR";
  const horizontal = dir === "LR" || dir === "RL";
  const sorted = [...nodes].sort((a, b) => {
    const aPrimary = horizontal ? a.bounds.x : a.bounds.y;
    const bPrimary = horizontal ? b.bounds.x : b.bounds.y;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    return (horizontal ? a.bounds.y : a.bounds.x) - (horizontal ? b.bounds.y : b.bounds.x);
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
    return { ...n, rank: r, order };
  });
}

function packNodes(
  nodeIds: string[],
  measureMap: Map<string, MeasuredNode>,
  mode: "pack" | "stack",
  density?: LayoutOptions["density"],
  gapPx = 28,
): Map<string, Rect> {
  const out = new Map<string, Rect>();
  let x = 0;
  let y = 0;
  let rowH = 0;
  const maxRowW = packMaxRowWidth(density);
  const gap = Math.max(0, gapPx);
  const rows: string[][] = [];
  let row: string[] = [];
  for (const id of nodeIds) {
    const m = measureMap.get(id);
    if (!m) continue;
    if (mode === "stack") {
      // Center narrower nodes on the column axis for a tidier band/column.
      out.set(id, { x: 0, y, width: m.width, height: m.height });
      y += m.height + gap;
      continue;
    }
    if (x > 0 && x + m.width > maxRowW) {
      rows.push(row);
      row = [];
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    out.set(id, { x, y, width: m.width, height: m.height });
    row.push(id);
    x += m.width + gap;
    rowH = Math.max(rowH, m.height);
  }
  if (row.length) rows.push(row);

  if (mode === "stack" && out.size > 1) {
    const maxW = Math.max(...[...out.values()].map((b) => b.width));
    for (const [id, b] of out) {
      out.set(id, { ...b, x: (maxW - b.width) / 2 });
    }
  } else if (mode === "pack" && rows.length > 0) {
    // Column-aligned grid: equalize column widths across wrapped rows and
    // top-align within each cell so mixed glyphs (person, hexagon, cloud)
    // share a clean top edge instead of floating mid-row.
    const colCount = Math.max(...rows.map((r) => r.length), 0);
    const colW = Array.from({ length: colCount }, () => 0);
    const rowHeights = Array.from({ length: rows.length }, () => 0);
    for (let r = 0; r < rows.length; r++) {
      const ids = rows[r]!;
      for (let c = 0; c < ids.length; c++) {
        const b = out.get(ids[c]!)!;
        colW[c] = Math.max(colW[c]!, b.width);
        rowHeights[r] = Math.max(rowHeights[r]!, b.height);
      }
    }
    let gy = 0;
    for (let r = 0; r < rows.length; r++) {
      const ids = rows[r]!;
      let gx = 0;
      for (let c = 0; c < ids.length; c++) {
        const id = ids[c]!;
        const b = out.get(id)!;
        out.set(id, { x: gx, y: gy, width: b.width, height: b.height });
        gx += colW[c]! + gap;
      }
      gy += rowHeights[r]! + gap;
    }
  }
  return out;
}

function aabbOf(rects: Iterable<Rect>): Rect | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let any = false;
  for (const b of rects) {
    any = true;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  if (!any) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function offsetRects(rects: Map<string, Rect>, dx: number, dy: number): void {
  for (const [id, b] of rects) {
    rects.set(id, { ...b, x: b.x + dx, y: b.y + dy });
  }
}

/**
 * Local ELK for nodes inside a group (and edges wholly inside it).
 * Returns node bounds relative to (0,0) content origin (no group padding).
 */
async function layoutCellFlow(
  graph: GraphModel,
  group: GraphGroup,
  measured: MeasuredNode[],
  options: LayoutOptions,
  flowDirection: NonNullable<LayoutOptions["direction"]>,
): Promise<Map<string, Rect>> {
  const nodeIds = new Set(collectDescendantNodeIds(graph, group.id));
  if (nodeIds.size === 0) return new Map();

  const subGraph: GraphModel = {
    ...graph,
    nodes: graph.nodes.filter((n) => nodeIds.has(n.id)),
    edges: graph.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)),
    groups: [],
  };
  const subMeasured = measured.filter((m) => nodeIds.has(m.nodeId));
  if (subMeasured.length === 0) return new Map();

  // Disconnected members: ELK often stacks components against the flow axis.
  // Pack along the cell direction instead (row cells → vertical, stack cells → horizontal).
  if (subGraph.edges.length === 0) {
    const ids = subMeasured.map((m) => m.nodeId);
    const measureMap = new Map(measured.map((m) => [m.nodeId, m]));
    const mode = flowDirection === "TD" || flowDirection === "BT" ? "stack" : "pack";
    return packNodes(ids, measureMap, mode, options.density, resolveLeafGap(undefined, options));
  }

  const elkGraph = buildElkGraph(subGraph, subMeasured, {
    ...options,
    direction: flowDirection,
    groupLayout: "flat",
  });
  const laid = await getElk().layout(elkGraph);
  const out = new Map<string, Rect>();
  for (const child of laid.children ?? []) {
    if (!nodeIds.has(child.id)) continue;
    out.set(child.id, {
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? 0,
      height: child.height ?? 0,
    });
  }
  // Normalize to content origin
  const box = aabbOf(out.values());
  if (box && (box.x !== 0 || box.y !== 0)) {
    offsetRects(out, -box.x, -box.y);
  }
  return out;
}

/** Center (or start/end) content inside a stretched slot's padded inner box. */
function contentOriginInSlot(
  slot: Rect,
  pad: { top: number; right: number; bottom: number; left: number },
  contentBox: Rect,
  align: NonNullable<LayoutOptions["align"]>,
): { x: number; y: number } {
  const innerW = Math.max(0, slot.width - pad.left - pad.right);
  const innerH = Math.max(0, slot.height - pad.top - pad.bottom);
  const freeX = Math.max(0, innerW - contentBox.width);
  const freeY = Math.max(0, innerH - contentBox.height);
  const ox = align === "end" ? freeX : align === "start" ? 0 : freeX / 2;
  const oy = align === "end" ? freeY : align === "start" ? 0 : freeY / 2;
  return { x: slot.x + pad.left + ox, y: slot.y + pad.top + oy };
}

function collectDescendantNodeIds(graph: GraphModel, groupId: string): string[] {
  const group = graph.groups.find((g) => g.id === groupId);
  if (!group) return [];
  const ids = [...group.nodeIds];
  const stack = [...group.childGroupIds];
  while (stack.length) {
    const cid = stack.pop()!;
    const child = graph.groups.find((g) => g.id === cid);
    if (!child) continue;
    ids.push(...child.nodeIds);
    stack.push(...child.childGroupIds);
  }
  return ids;
}

function childGroupsOf(graph: GraphModel, parentId: string | undefined): GraphGroup[] {
  return graph.groups.filter((g) => g.parentId === parentId);
}

/** Reconstruct declaration order when `members` is missing (older compiled graphs). */
function fallbackTrackMembers(
  graph: GraphModel,
  parent: GraphGroup,
  children: GraphGroup[],
): Array<{ kind: "node"; id: string } | { kind: "group"; id: string }> {
  type Item = { kind: "node" | "group"; id: string; order: number };
  const items: Item[] = [];
  for (const id of parent.nodeIds) {
    const n = graph.nodes.find((node) => node.id === id);
    items.push({
      kind: "node",
      id,
      order: n?.sourceRange?.start.offset ?? Number.MAX_SAFE_INTEGER,
    });
  }
  for (const child of children) {
    let order = Number.MAX_SAFE_INTEGER;
    for (const nid of collectDescendantNodeIds(graph, child.id)) {
      const n = graph.nodes.find((node) => node.id === nid);
      const o = n?.sourceRange?.start.offset;
      if (o != null) order = Math.min(order, o);
    }
    items.push({ kind: "group", id: child.id, order });
  }
  items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return items.map(({ kind, id }) =>
    kind === "node" ? { kind: "node", id } : { kind: "group", id },
  );
}

/** Diagram-level declaration order across ungrouped nodes and top-level regions. */
function topLevelTrackMembers(
  graph: GraphModel,
  children: GraphGroup[],
): Array<{ kind: "node"; id: string } | { kind: "group"; id: string }> {
  type Item = { kind: "node" | "group"; id: string; order: number };
  const items: Item[] = graph.nodes
    .filter((node) => node.groupId == null)
    .map((node) => ({
      kind: "node" as const,
      id: node.id,
      order: node.sourceRange?.start.offset ?? Number.MAX_SAFE_INTEGER,
    }));

  for (const child of children) {
    let order = Number.MAX_SAFE_INTEGER;
    for (const nodeId of collectDescendantNodeIds(graph, child.id)) {
      const offset = graph.nodes.find((node) => node.id === nodeId)?.sourceRange?.start.offset;
      if (offset != null) order = Math.min(order, offset);
    }
    items.push({ kind: "group", id: child.id, order });
  }

  items.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return items.map(({ kind, id }) => ({ kind, id }));
}

type ArrangeContext = {
  graph: GraphModel;
  measured: MeasuredNode[];
  measureMap: Map<string, MeasuredNode>;
  options: LayoutOptions;
  nodeBounds: Map<string, Rect>;
  groupBounds: Map<string, Rect>;
};

/**
 * `arrange: surround` — one nested hub group at center; sibling nodes on a ring
 * inside the parent chrome.
 */
async function layoutSurroundParent(ctx: ArrangeContext, parent: GraphGroup | null): Promise<void> {
  if (!parent) return;

  const children = childGroupsOf(ctx.graph, parent.id);
  if (children.length !== 1) return;
  const hub = children[0]!;

  // Depth-first: nested arrange first
  if (groupHasRegionArrange(hub)) {
    await layoutArrangedParent(ctx, hub);
  }

  let hubWidth: number;
  let hubHeight: number;
  const hubContent = new Map<string, Rect>();

  if (ctx.groupBounds.has(hub.id) && groupHasRegionArrange(hub)) {
    const gb = ctx.groupBounds.get(hub.id)!;
    hubWidth = gb.width;
    hubHeight = gb.height;
  } else {
    const mode = hub.cellArrange ?? "flow";
    const leafGap = resolveLeafGap(hub.gap, ctx.options);
    let content: Map<string, Rect>;
    if (mode === "pack" || mode === "stack") {
      content = packNodes(hub.nodeIds, ctx.measureMap, mode, ctx.options.density, leafGap);
    } else {
      content = await layoutCellFlow(ctx.graph, hub, ctx.measured, ctx.options, "TD");
    }
    for (const [id, rect] of content) hubContent.set(id, rect);
    const pad = paddingForGroup(hub);
    const contentBox = aabbOf(content.values()) ?? { x: 0, y: 0, width: 80, height: 40 };
    hubWidth = contentBox.width + pad.left + pad.right;
    hubHeight = contentBox.height + pad.top + pad.bottom;
  }

  const satellites = parent.nodeIds
    .map((id) => {
      const m = ctx.measureMap.get(id);
      const node = ctx.graph.nodes.find((n) => n.id === id);
      if (!m) return null;
      return {
        id,
        width: m.width,
        height: m.height,
        side: node?.side,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s != null);

  const gap = resolveTrackGap(parent.gap ?? ctx.options.gap, ctx.options);
  const placed = regionArrangeSurround({
    hub: { width: hubWidth, height: hubHeight },
    satellites,
    gap,
    origin: { x: LAYOUT_MARGIN, y: LAYOUT_MARGIN },
  });

  // Place hub (and shift nested subtree or write leaf content).
  if (hubContent.size > 0) {
    const pad = paddingForGroup(hub);
    ctx.groupBounds.set(hub.id, placed.hub);
    const contentBox = aabbOf(hubContent.values()) ?? { x: 0, y: 0, width: 0, height: 0 };
    const origin = contentOriginInSlot(placed.hub, pad, contentBox, parent.align ?? "center");
    for (const [nodeId, local] of hubContent) {
      ctx.nodeBounds.set(nodeId, {
        x: origin.x + (local.x - contentBox.x),
        y: origin.y + (local.y - contentBox.y),
        width: local.width,
        height: local.height,
      });
    }
  } else if (groupHasRegionArrange(hub)) {
    const prev = ctx.groupBounds.get(hub.id);
    if (prev) {
      const dx = placed.hub.x - prev.x;
      const dy = placed.hub.y - prev.y;
      ctx.groupBounds.set(hub.id, placed.hub);
      if (dx !== 0 || dy !== 0) {
        for (const nid of collectDescendantNodeIds(ctx.graph, hub.id)) {
          const b = ctx.nodeBounds.get(nid);
          if (b) ctx.nodeBounds.set(nid, { ...b, x: b.x + dx, y: b.y + dy });
        }
        const stack = [...hub.childGroupIds];
        while (stack.length) {
          const cid = stack.pop()!;
          const gb = ctx.groupBounds.get(cid);
          if (gb) ctx.groupBounds.set(cid, { ...gb, x: gb.x + dx, y: gb.y + dy });
          const g = ctx.graph.groups.find((x) => x.id === cid);
          if (g) stack.push(...g.childGroupIds);
        }
      }
    } else {
      ctx.groupBounds.set(hub.id, placed.hub);
    }
  } else {
    ctx.groupBounds.set(hub.id, placed.hub);
  }

  for (const sat of placed.satellites) {
    ctx.nodeBounds.set(sat.groupId, { ...sat.bounds });
  }

  const pad = paddingForGroup(parent);
  let shell: Rect = {
    x: placed.contentBounds.x - pad.left,
    y: placed.contentBounds.y - pad.top,
    width: placed.contentBounds.width + pad.left + pad.right,
    height: placed.contentBounds.height + pad.top + pad.bottom,
  };
  if (prefersSquareGroupChrome(parent.shape)) {
    shell = squareUpBounds(shell);
  }
  ctx.groupBounds.set(parent.id, shell);
}

/**
 * Layout one arranged parent: size children, pack tracks, write world node/group bounds.
 * Direct member nodes participate as track cells (declaration order via `members`).
 */
async function layoutArrangedParent(ctx: ArrangeContext, parent: GraphGroup | null): Promise<void> {
  const arrange = parent?.arrange ?? ctx.options.arrange;
  if (!arrange) return;

  if (arrange === "surround") {
    await layoutSurroundParent(ctx, parent);
    return;
  }

  const children = childGroupsOf(ctx.graph, parent?.id);
  const members =
    parent?.members && parent.members.length > 0
      ? parent.members
      : parent
        ? fallbackTrackMembers(ctx.graph, parent, children)
        : topLevelTrackMembers(ctx.graph, children);
  const trackMembers = members;
  if (trackMembers.length === 0) return;

  const align = parent?.align ?? ctx.options.align ?? "stretch";
  const flowDirection = cellFlowDirection(arrange);
  const childById = new Map(children.map((g) => [g.id, g]));

  // Depth-first: nested arrange first
  for (const child of children) {
    if (groupHasRegionArrange(child)) {
      await layoutArrangedParent(ctx, child);
    }
  }

  const cells: RegionCell[] = [];
  const childContent = new Map<string, Map<string, Rect>>();

  for (const member of trackMembers) {
    if (member.kind === "node") {
      const m = ctx.measureMap.get(member.id);
      if (!m) continue;
      cells.push({
        groupId: nodeCellId(member.id),
        width: m.width,
        height: m.height,
      });
      continue;
    }

    const child = childById.get(member.id);
    if (!child) continue;

    let content: Map<string, Rect>;
    if (ctx.groupBounds.has(child.id) && groupHasRegionArrange(child)) {
      // Already laid out as nested arrange — use existing group bounds as cell size.
      const gb = ctx.groupBounds.get(child.id)!;
      cells.push({
        groupId: child.id,
        width: gb.width,
        height: gb.height,
        column: child.column,
        row: child.row,
        colSpan: child.colSpan ?? child.span,
        rowSpan: child.rowSpan,
      });
      continue;
    }

    const mode = child.cellArrange ?? "flow";
    const leafGap = resolveLeafGap(child.gap, ctx.options);
    if (mode === "pack" || mode === "stack") {
      content = packNodes(child.nodeIds, ctx.measureMap, mode, ctx.options.density, leafGap);
    } else {
      content = await layoutCellFlow(ctx.graph, child, ctx.measured, ctx.options, flowDirection);
    }
    childContent.set(child.id, content);

    const pad = paddingForGroup(child);
    const contentBox = aabbOf(content.values()) ?? { x: 0, y: 0, width: 80, height: 40 };
    const width = contentBox.width + pad.left + pad.right;
    const height = contentBox.height + pad.top + pad.bottom;
    cells.push({
      groupId: child.id,
      width,
      height,
      column: child.column,
      row: child.row,
      colSpan: child.colSpan ?? child.span,
      rowSpan: child.rowSpan,
    });
  }

  const placed = regionArrange({
    arrange,
    align,
    gap: resolveTrackGap(parent?.gap ?? ctx.options.gap, ctx.options),
    columns: parent?.columns ?? ctx.options.columns,
    rows: parent?.rows ?? ctx.options.rows,
    cells,
    origin: { x: LAYOUT_MARGIN, y: LAYOUT_MARGIN },
  });

  for (const slot of placed) {
    const directNodeId = parseNodeCellId(slot.groupId);
    if (directNodeId) {
      const m = ctx.measureMap.get(directNodeId);
      if (m) {
        const contentBox = { x: 0, y: 0, width: m.width, height: m.height };
        const origin = contentOriginInSlot(
          slot.bounds,
          { top: 0, right: 0, bottom: 0, left: 0 },
          contentBox,
          align,
        );
        ctx.nodeBounds.set(directNodeId, {
          x: origin.x,
          y: origin.y,
          width: m.width,
          height: m.height,
        });
      } else {
        ctx.nodeBounds.set(directNodeId, { ...slot.bounds });
      }
      continue;
    }

    const child = childById.get(slot.groupId);
    if (!child) continue;
    const pad = paddingForGroup(child);

    const content = childContent.get(child.id);
    if (content) {
      ctx.groupBounds.set(child.id, slot.bounds);
      const contentBox = aabbOf(content.values()) ?? { x: 0, y: 0, width: 0, height: 0 };
      const origin = contentOriginInSlot(slot.bounds, pad, contentBox, align);
      for (const [nodeId, local] of content) {
        ctx.nodeBounds.set(nodeId, {
          x: origin.x + (local.x - contentBox.x),
          y: origin.y + (local.y - contentBox.y),
          width: local.width,
          height: local.height,
        });
      }
    } else if (groupHasRegionArrange(child)) {
      // Nested arranged group: shift its subtree into this slot.
      // Read prev bounds BEFORE overwriting — otherwise dx/dy collapse to 0.
      const prev = ctx.groupBounds.get(child.id);
      if (prev) {
        const dx = slot.bounds.x - prev.x;
        const dy = slot.bounds.y - prev.y;
        ctx.groupBounds.set(child.id, slot.bounds);
        if (dx !== 0 || dy !== 0) {
          for (const nid of collectDescendantNodeIds(ctx.graph, child.id)) {
            const b = ctx.nodeBounds.get(nid);
            if (b) ctx.nodeBounds.set(nid, { ...b, x: b.x + dx, y: b.y + dy });
          }
          const stack = [...child.childGroupIds];
          while (stack.length) {
            const cid = stack.pop()!;
            const gb = ctx.groupBounds.get(cid);
            if (gb) ctx.groupBounds.set(cid, { ...gb, x: gb.x + dx, y: gb.y + dy });
            const g = ctx.graph.groups.find((x) => x.id === cid);
            if (g) stack.push(...g.childGroupIds);
          }
        }
      } else {
        ctx.groupBounds.set(child.id, slot.bounds);
      }
    } else {
      ctx.groupBounds.set(child.id, slot.bounds);
    }
  }

  // Parent shell bounds
  if (parent) {
    const box = aabbOf(placed.map((p) => p.bounds));
    if (box) {
      const pad = paddingForGroup(parent);
      let shell: Rect = {
        x: box.x - pad.left,
        y: box.y - pad.top,
        width: box.width + pad.left + pad.right,
        height: box.height + pad.top + pad.bottom,
      };
      if (prefersSquareGroupChrome(parent.shape)) {
        shell = squareUpBounds(shell);
      }
      ctx.groupBounds.set(parent.id, shell);
    }
  }
}

function stubOrthogonalEdge(
  edgeId: string,
  fromId: string,
  toId: string,
  from: Rect,
  to: Rect,
  obstacles: Rect[],
  pad: number,
  tFrom: number,
  tTo: number,
): ElkEdge {
  const points = routeOrthogonalAvoiding(from, to, obstacles, pad, tFrom, tTo);
  const start = points[0]!;
  const end = points[points.length - 1]!;
  const bendPoints = points.slice(1, -1);
  return {
    id: edgeId,
    sources: [fromId],
    targets: [toId],
    sections: [
      {
        id: `${edgeId}_s0`,
        startPoint: { x: start.x, y: start.y },
        endPoint: { x: end.x, y: end.y },
        bendPoints,
      },
    ],
  };
}

function fanSlot(index: number, count: number): number {
  if (count <= 1) return 0.5;
  // Spread shared-face fans enough to read as distinct corridors (esp. Loose/spacious).
  return 0.28 + (0.44 * index) / (count - 1);
}

type OrthoSide = "N" | "S" | "E" | "W";

function primaryExitSide(from: Rect, to: Rect): OrthoSide {
  return preferredSidePair(from, to)[0];
}

function primaryEntrySide(from: Rect, to: Rect): OrthoSide {
  return preferredSidePair(from, to)[1];
}

/** Sort key along a face — left→right for N/S, top→bottom for E/W. */
function faceSortKey(node: Rect, other: Rect, side: OrthoSide): number {
  const ox = other.x + other.width / 2;
  const oy = other.y + other.height / 2;
  if (side === "N" || side === "S") return ox - node.x;
  return oy - node.y;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Channel between facing sides of two boxes (primary axis only).
 * Used to decide which group chrome actually sits *between* the endpoints.
 */
function facingStrip(from: Rect, to: Rect): Rect | null {
  const [fs] = preferredSidePair(from, to);
  if (fs === "E" || fs === "W") {
    const x0 = fs === "E" ? from.x + from.width : to.x + to.width;
    const x1 = fs === "E" ? to.x : from.x;
    if (x1 <= x0 + 1) return null;
    const y0 = Math.min(from.y, to.y);
    const y1 = Math.max(from.y + from.height, to.y + to.height);
    return { x: x0, y: y0, width: x1 - x0, height: Math.max(1, y1 - y0) };
  }
  const y0 = fs === "S" ? from.y + from.height : to.y + to.height;
  const y1 = fs === "S" ? to.y : from.y;
  if (y1 <= y0 + 1) return null;
  const x0 = Math.min(from.x, to.x);
  const x1 = Math.max(from.x + from.width, to.x + to.width);
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: y1 - y0 };
}

/**
 * Fan attach slots only among edges that share the same exit/entry face.
 * A lone edge on a face stays centered (t=0.5).
 */
function sideAwareFanSlots(
  routed: Array<{ id: string; from: string; to: string }>,
  nodeBounds: Map<string, Rect>,
): { tFrom: Map<string, number>; tTo: Map<string, number> } {
  const tFrom = new Map<string, number>();
  const tTo = new Map<string, number>();

  type Member = { edgeId: string; key: number };
  const outGroups = new Map<string, Member[]>();
  const inGroups = new Map<string, Member[]>();

  for (const e of routed) {
    const from = nodeBounds.get(e.from)!;
    const to = nodeBounds.get(e.to)!;
    const outSide = primaryExitSide(from, to);
    const inSide = primaryEntrySide(from, to);
    const outKey = `${e.from}:${outSide}`;
    const inKey = `${e.to}:${inSide}`;
    if (!outGroups.has(outKey)) outGroups.set(outKey, []);
    if (!inGroups.has(inKey)) inGroups.set(inKey, []);
    outGroups.get(outKey)!.push({ edgeId: e.id, key: faceSortKey(from, to, outSide) });
    inGroups.get(inKey)!.push({ edgeId: e.id, key: faceSortKey(to, from, inSide) });
  }

  for (const members of outGroups.values()) {
    members.sort((a, b) => a.key - b.key);
    members.forEach((m, i) => tFrom.set(m.edgeId, fanSlot(i, members.length)));
  }
  for (const members of inGroups.values()) {
    members.sort((a, b) => a.key - b.key);
    members.forEach((m, i) => tTo.set(m.edgeId, fanSlot(i, members.length)));
  }

  return { tFrom, tTo };
}

function buildFixedElkGraph(
  graph: GraphModel,
  nodeBounds: Map<string, Rect>,
  groupBounds: Map<string, Rect>,
  options: LayoutOptions,
): ElkGraph {
  const children: ElkNode[] = [];
  for (const node of graph.nodes) {
    const b = nodeBounds.get(node.id);
    if (!b) continue;
    children.push({
      id: node.id,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
    });
  }

  const clearance = Math.max(
    MIN_EDGE_NODE_CLEARANCE,
    options.edgeNodeSpacing ?? MIN_EDGE_NODE_CLEARANCE,
  );
  // Footprint avoidance uses a tighter pad so gutters between cards stay usable;
  // ELK spacing still uses full clearance for the fixed pass metadata.
  const avoidPad = Math.min(12, clearance);
  const routed = graph.edges.filter((e) => nodeBounds.has(e.from) && nodeBounds.has(e.to));
  const { tFrom, tTo } = sideAwareFanSlots(routed, nodeBounds);

  const memberCache = new Map<string, Set<string>>();
  const membersOf = (groupId: string): Set<string> => {
    let set = memberCache.get(groupId);
    if (!set) {
      set = new Set(collectDescendantNodeIds(graph, groupId));
      memberCache.set(groupId, set);
    }
    return set;
  };

  const descendantGroups = (groupId: string): Set<string> => {
    const out = new Set<string>([groupId]);
    const stack = [groupId];
    while (stack.length) {
      const id = stack.pop()!;
      const g = graph.groups.find((x) => x.id === id);
      if (!g) continue;
      for (const child of g.childGroupIds) {
        if (out.has(child)) continue;
        out.add(child);
        stack.push(child);
      }
    }
    return out;
  };

  /** Groups that contain `nodeId` but not `otherId`, plus their nested groups. */
  const exclusiveSubtree = (nodeId: string, otherId: string): Set<string> => {
    const skip = new Set<string>();
    for (const g of graph.groups) {
      const members = membersOf(g.id);
      if (!members.has(nodeId) || members.has(otherId)) continue;
      for (const id of descendantGroups(g.id)) skip.add(id);
    }
    return skip;
  };

  const edges = routed.map((e) => {
    const from = nodeBounds.get(e.from)!;
    const to = nodeBounds.get(e.to)!;
    const obstacles: Rect[] = [];
    for (const [id, b] of nodeBounds) {
      if (id === e.from || id === e.to) continue;
      obstacles.push(b);
    }
    // Group chrome only when it sits in the facing strip AND isn't part of either
    // endpoint's exclusive nest (avoids mid-column stretch bands blocking column hops,
    // which used to force perimeter tours around the whole platform).
    const strip = facingStrip(from, to);
    if (strip) {
      const skip = new Set<string>([
        ...exclusiveSubtree(e.from, e.to),
        ...exclusiveSubtree(e.to, e.from),
      ]);
      for (const [gid, gb] of groupBounds) {
        if (skip.has(gid)) continue;
        const members = membersOf(gid);
        if (members.has(e.from) || members.has(e.to)) continue;
        if (!rectsOverlap(gb, strip)) continue;
        obstacles.push(gb);
      }
    }
    return stubOrthogonalEdge(
      e.id,
      e.from,
      e.to,
      from,
      to,
      obstacles,
      avoidPad,
      tFrom.get(e.id) ?? 0.5,
      tTo.get(e.id) ?? 0.5,
    );
  });

  return {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "fixed",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.direction":
        options.direction === "TD"
          ? "DOWN"
          : options.direction === "BT"
            ? "UP"
            : options.direction === "RL"
              ? "LEFT"
              : "RIGHT",
      "elk.spacing.nodeNode": "40",
      "elk.spacing.edgeNode": String(clearance),
      "elk.spacing.edgeEdge": String(options.edgeEdgeSpacing ?? 18),
      "elk.padding": `[top=${LAYOUT_MARGIN},left=${LAYOUT_MARGIN},bottom=${LAYOUT_MARGIN},right=${LAYOUT_MARGIN}]`,
    },
    children,
    edges,
  };
}

/**
 * Region-arrange path: local cell layouts → track packing → fixed-position ELK for edges.
 */
export async function layoutAndRouteArranged(
  graph: GraphModel,
  measured: MeasuredNode[],
  options: LayoutOptions,
): Promise<ArrangedLayoutResult> {
  const t0 = performance.now();
  const direction = options.direction ?? "LR";
  const measureMap = new Map(measured.map((m) => [m.nodeId, m]));
  const ctx: ArrangeContext = {
    graph,
    measured,
    measureMap,
    options,
    nodeBounds: new Map(),
    groupBounds: new Map(),
  };

  // Arranged parents (deepest first via recursion)
  if (options.arrange) {
    await layoutArrangedParent(ctx, null);
  } else {
    const arrangedParents = graph.groups.filter((g) => groupHasRegionArrange(g));
    const roots = arrangedParents.filter((g) => {
      if (!g.parentId) return true;
      const parent = graph.groups.find((p) => p.id === g.parentId);
      return !parent || !groupHasRegionArrange(parent);
    });
    for (const root of roots) {
      await layoutArrangedParent(ctx, root);
    }
  }

  // Residual nodes: park sources on the incoming side and sinks on the outgoing
  // side so client→system→external edges do not cut through the arranged core.
  const placedIds = new Set(ctx.nodeBounds.keys());
  const residualIds = graph.nodes.filter((n) => !placedIds.has(n.id)).map((n) => n.id);
  if (residualIds.length) {
    const residualSet = new Set(residualIds);
    const sources: string[] = [];
    const sinks: string[] = [];
    const other: string[] = [];
    for (const id of residualIds) {
      const feedsIn = graph.edges.some((e) => e.from === id && !residualSet.has(e.to));
      const fedFrom = graph.edges.some((e) => e.to === id && !residualSet.has(e.from));
      if (feedsIn && !fedFrom) sources.push(id);
      else if (fedFrom && !feedsIn) sinks.push(id);
      else other.push(id);
    }

    const placePack = (ids: string[], side: "before" | "after"): void => {
      if (ids.length === 0) return;
      const packMode =
        direction === "TD" || direction === "BT" ? ("pack" as const) : ("stack" as const);
      const packed = packNodes(
        ids,
        measureMap,
        packMode,
        options.density,
        resolveLeafGap(undefined, options),
      );
      const packedBox = aabbOf(packed.values()) ?? { x: 0, y: 0, width: 80, height: 40 };
      const arrangedBox = aabbOf(ctx.nodeBounds.values());
      let originX = LAYOUT_MARGIN;
      let originY = LAYOUT_MARGIN;
      if (arrangedBox) {
        if (direction === "TD" || direction === "BT") {
          originX = arrangedBox.x;
          originY =
            side === "before"
              ? arrangedBox.y - packedBox.height - DEFAULT_RESIDUAL_GAP
              : arrangedBox.y + arrangedBox.height + DEFAULT_RESIDUAL_GAP;
        } else {
          originY = arrangedBox.y;
          originX =
            side === "before"
              ? arrangedBox.x - packedBox.width - DEFAULT_RESIDUAL_GAP
              : arrangedBox.x + arrangedBox.width + DEFAULT_RESIDUAL_GAP;
        }
      }
      for (const [id, b] of packed) {
        ctx.nodeBounds.set(id, {
          ...b,
          x: b.x - packedBox.x + originX,
          y: b.y - packedBox.y + originY,
        });
      }
    };

    placePack(sources, "before");
    placePack([...sinks, ...other], "after");

    const allBox = aabbOf(ctx.nodeBounds.values());
    if (allBox && (allBox.x < LAYOUT_MARGIN || allBox.y < LAYOUT_MARGIN)) {
      const dx = Math.max(0, LAYOUT_MARGIN - allBox.x);
      const dy = Math.max(0, LAYOUT_MARGIN - allBox.y);
      if (dx || dy) {
        for (const [id, b] of ctx.nodeBounds) {
          ctx.nodeBounds.set(id, { ...b, x: b.x + dx, y: b.y + dy });
        }
        for (const [id, b] of ctx.groupBounds) {
          ctx.groupBounds.set(id, { ...b, x: b.x + dx, y: b.y + dy });
        }
      }
    }
  }

  // Edge routing with fixed node positions
  const elkGraph = buildFixedElkGraph(graph, ctx.nodeBounds, ctx.groupBounds, {
    ...options,
    direction,
  });
  const laid = await getElk().layout(elkGraph);

  // Keep our node positions (fixed alg should preserve; still prefer ours)
  const laidOutNodes: LaidOutNode[] = ranksFromFixed(
    [...ctx.nodeBounds.entries()].map(([nodeId, bounds]) => ({
      nodeId,
      bounds,
      rank: 0,
      order: 0,
    })),
    direction,
  );

  const groups: LaidOutGroup[] = [];
  for (const g of graph.groups) {
    const bounds = ctx.groupBounds.get(g.id);
    if (!bounds) continue;
    const padding = paddingForGroup(g);
    groups.push({
      groupId: g.id,
      bounds,
      labelBox: measureGroupLabelBox(
        g.label,
        bounds,
        Boolean(g.icon && g.icon !== "none" && g.chrome !== false),
      ),
      padding,
    });
  }

  // Collect edges from fixed layout
  const rawPaths: LayoutEdgePath[] = [];
  for (const edge of laid.edges ?? []) {
    const points: { x: number; y: number }[] = [];
    for (const section of edge.sections ?? []) {
      points.push({ ...section.startPoint });
      for (const bend of section.bendPoints ?? []) points.push({ ...bend });
      points.push({ ...section.endPoint });
    }
    if (points.length >= 2) rawPaths.push({ edgeId: edge.id, points });
  }
  // Also walk children edges if any
  const walkEdges = (node: ElkNode) => {
    for (const edge of node.edges ?? []) {
      if (rawPaths.some((p) => p.edgeId === edge.id)) continue;
      const points: { x: number; y: number }[] = [];
      for (const section of edge.sections ?? []) {
        points.push({
          x: (section.startPoint.x ?? 0) + (node.x ?? 0),
          y: (section.startPoint.y ?? 0) + (node.y ?? 0),
        });
        for (const bend of section.bendPoints ?? []) {
          points.push({ x: bend.x + (node.x ?? 0), y: bend.y + (node.y ?? 0) });
        }
        points.push({
          x: (section.endPoint.x ?? 0) + (node.x ?? 0),
          y: (section.endPoint.y ?? 0) + (node.y ?? 0),
        });
      }
      if (points.length >= 2) rawPaths.push({ edgeId: edge.id, points });
    }
    for (const c of node.children ?? []) walkEdges(c);
  };
  walkEdges(laid);

  const attachedPaths = snapEdgeEndpointsToGeometry(graph, laidOutNodes, rawPaths);
  // Fixed stubs are already corridor-aware; skip clearOrthogonalCorridors (it
  // creates loops when fan-out edges share a waypoint).
  const edgePaths = attachedPaths.map((path) => ({
    ...path,
    points: ensureOrthogonalPoints(collapseColinearPoints(path.points)),
  }));
  const edgeLabels: LayoutEdgeLabel[] = [];

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

  return {
    layout: {
      nodes: laidOutNodes,
      groups,
      edgePaths,
      edgeLabels,
      direction,
      algorithmVersion: ELK_LAYOUT_ALGORITHM,
      layoutMs: performance.now() - t0,
      width: maxX + 8,
      height: maxY + 8,
    },
    edges: edgePaths,
    routerAlgorithm: ELK_ROUTER_ALGORITHM,
  };
}

const DEFAULT_RESIDUAL_GAP = 48;
