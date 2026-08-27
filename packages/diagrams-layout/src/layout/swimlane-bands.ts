import type { GraphModel, LayoutOptions, Rect } from "@kekonic/diagrams-core";
import type { LaidOutGroup, LaidOutNode } from "./types.ts";
import {
  LAYOUT_MARGIN,
  SWIMLANE_HEADER_PAD_LEFT,
  SWIMLANE_HEADER_PAD_RIGHT,
  SWIMLANE_HEADER_WIDTH,
  SWIMLANE_STACK_GAP,
} from "./constants.ts";
import {
  computeGroupBounds,
  GROUP_ICON_GAP,
  GROUP_ICON_SIZE,
  paddingForGroup,
} from "./group-bounds.ts";

const SAME_RANK_SLACK = 8;

export function hasTopLevelSwimlanes(graph: GraphModel): boolean {
  return graph.groups.some((group) => group.kind === "swimlane" && group.parentId == null);
}

/**
 * When top-level `swimlane` groups exist, use a shared LR timeline unless the
 * author set `groupLayout: flat`. Nested ELK compounds are intentionally not
 * used: they rank each lane in isolation and invert process time.
 */
export function resolveSwimlaneLayoutOptions(
  graph: GraphModel,
  options: LayoutOptions,
): LayoutOptions {
  if (!hasTopLevelSwimlanes(graph)) return options;
  return {
    ...options,
    direction: options.direction ?? "LR",
    groupLayout: options.groupLayout === "flat" ? "flat" : "swimlane",
  };
}

function topLevelSwimlaneIds(graph: GraphModel): string[] {
  return graph.groups
    .filter((group) => group.kind === "swimlane" && group.parentId == null)
    .map((group) => group.id);
}

const HEADER_LINE_HEIGHT = 14;
/** 11px bold group title with tracking — slightly pessimistic so lines wrap before the rule. */
const HEADER_CHAR_WIDTH = 11 * 0.68;

export function wrapSwimlaneHeaderLabel(label: string, maxWidth: number): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [label];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length * HEADER_CHAR_WIDTH > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function measureHeaderLabel(label: string, headerBox: Rect, hasIcon: boolean): Rect {
  const innerWidth = Math.max(
    headerBox.width - SWIMLANE_HEADER_PAD_LEFT - SWIMLANE_HEADER_PAD_RIGHT,
    24,
  );
  const wrapWidth = hasIcon
    ? Math.max(innerWidth - GROUP_ICON_SIZE - GROUP_ICON_GAP, 24)
    : innerWidth;
  const lines = wrapSwimlaneHeaderLabel(label, wrapWidth);
  const height = Math.max(lines.length * HEADER_LINE_HEIGHT, 19);
  return {
    x: headerBox.x + SWIMLANE_HEADER_PAD_LEFT,
    y: headerBox.y + (headerBox.height - height) / 2,
    width: innerWidth,
    height,
  };
}

function stackedHeight(column: LaidOutNode[]): number {
  return (
    column.reduce((sum, node) => sum + node.bounds.height, 0) +
    SWIMLANE_STACK_GAP * Math.max(0, column.length - 1)
  );
}

/** Keep ELK X (shared timeline). Stack only when two members share a rank. */
function packLaneRow(members: LaidOutNode[]): LaidOutNode[] {
  if (members.length === 0) return [];
  if (members.length === 1) {
    const node = members[0]!;
    return [{ ...node, bounds: { ...node.bounds, y: 0 } }];
  }

  const sorted = [...members].sort((a, b) => a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y);
  const columns: LaidOutNode[][] = [];
  for (const node of sorted) {
    const column = columns[columns.length - 1];
    if (column) {
      const columnRight = Math.max(...column.map((item) => item.bounds.x + item.bounds.width));
      if (node.bounds.x < columnRight - SAME_RANK_SLACK) {
        column.push(node);
        continue;
      }
    }
    columns.push([node]);
  }

  const contentHeight = Math.max(...columns.map(stackedHeight));
  const placed: LaidOutNode[] = [];
  for (const column of columns) {
    const ordered = [...column].sort((a, b) => a.bounds.y - b.bounds.y);
    let y = (contentHeight - stackedHeight(ordered)) / 2;
    for (const node of ordered) {
      placed.push({ ...node, bounds: { ...node.bounds, y } });
      y += node.bounds.height + SWIMLANE_STACK_GAP;
    }
  }
  return placed;
}

function paintLane(
  group: LaidOutGroup,
  source: GraphModel["groups"][number] | undefined,
  bounds: Rect,
): LaidOutGroup {
  const headerBox: Rect = {
    x: bounds.x,
    y: bounds.y,
    width: SWIMLANE_HEADER_WIDTH,
    height: bounds.height,
  };
  const hasIcon = Boolean(source?.icon && source.icon !== "none" && source.chrome !== false);
  return {
    ...group,
    bounds,
    headerBox,
    labelBox: measureHeaderLabel(source?.label ?? group.groupId, headerBox, hasIcon),
    padding: { ...group.padding, left: SWIMLANE_HEADER_WIDTH },
  };
}

function shareBandWidth(
  graph: GraphModel,
  nodes: LaidOutNode[],
  groups: LaidOutGroup[],
  laneIds: string[],
): { nodes: LaidOutNode[]; groups: LaidOutGroup[]; shiftX: number } {
  const byId = new Map(groups.map((group) => [group.groupId, group]));
  const lanes = laneIds
    .map((id) => byId.get(id))
    .filter((group): group is LaidOutGroup => group != null);
  if (lanes.length === 0) return { nodes, groups, shiftX: 0 };

  const contentLeft = Math.min(...lanes.map((lane) => lane.bounds.x + lane.padding.left));
  const contentRight = Math.max(
    ...lanes.map((lane) => lane.bounds.x + lane.bounds.width - lane.padding.right),
  );
  const bandLeft = contentLeft - SWIMLANE_HEADER_WIDTH;
  const bandRight = Math.max(
    contentRight + Math.min(...lanes.map((lane) => lane.padding.right)),
    bandLeft + SWIMLANE_HEADER_WIDTH + 40,
  );

  const nextGroups = groups.map((group) => {
    if (!laneIds.includes(group.groupId)) return group;
    const source = graph.groups.find((item) => item.id === group.groupId);
    return paintLane(group, source, {
      x: bandLeft,
      y: group.bounds.y,
      width: bandRight - bandLeft,
      height: group.bounds.height,
    });
  });

  return shiftIfNeeded(nodes, nextGroups);
}

function shiftIfNeeded(
  nodes: LaidOutNode[],
  groups: LaidOutGroup[],
): { nodes: LaidOutNode[]; groups: LaidOutGroup[]; shiftX: number } {
  const minX = Math.min(...groups.map((group) => group.bounds.x));
  const shift = minX < LAYOUT_MARGIN ? LAYOUT_MARGIN - minX : 0;
  if (shift === 0) return { nodes, groups, shiftX: 0 };

  const shiftRect = (box: Rect): Rect => ({ ...box, x: box.x + shift });
  return {
    nodes: nodes.map((node) => ({ ...node, bounds: shiftRect(node.bounds) })),
    groups: groups.map((group) => ({
      ...group,
      bounds: shiftRect(group.bounds),
      labelBox: shiftRect(group.labelBox),
      headerBox: group.headerBox ? shiftRect(group.headerBox) : undefined,
    })),
    shiftX: shift,
  };
}

/**
 * Stretch top-level swimlane boxes to a shared content X-span and a left header
 * strip. Pack members into declaration-order bands that tile with no gap,
 * keeping ELK X so process time still reads left to right.
 */
export function applySwimlaneBands(
  graph: GraphModel,
  nodes: LaidOutNode[],
  groups: LaidOutGroup[],
): { nodes: LaidOutNode[]; groups: LaidOutGroup[]; shiftX: number } {
  const laneIds = topLevelSwimlaneIds(graph);
  if (laneIds.length === 0) return { nodes, groups, shiftX: 0 };

  const byId = new Map(groups.map((group) => [group.groupId, group]));
  const nextNodes = nodes.map((node) => ({ ...node, bounds: { ...node.bounds } }));
  const index = new Map(nextNodes.map((node, i) => [node.nodeId, i]));

  let cursorY = LAYOUT_MARGIN;
  let packedAny = false;
  const bandByLane = new Map<string, Rect>();

  for (const laneId of laneIds) {
    const source = graph.groups.find((item) => item.id === laneId);
    const group = byId.get(laneId);
    if (!source || !group) continue;
    const members = source.nodeIds
      .map((id) => {
        const i = index.get(id);
        return i == null ? undefined : nextNodes[i];
      })
      .filter((node): node is LaidOutNode => node != null);
    if (members.length === 0) continue;

    packedAny = true;
    const pad = paddingForGroup(source);
    const packed = packLaneRow(members);
    const contentHeight = Math.max(...packed.map((node) => node.bounds.y + node.bounds.height), 0);
    const band: Rect = {
      x: group.bounds.x,
      y: cursorY,
      width: group.bounds.width,
      height: contentHeight + pad.top + pad.bottom,
    };
    for (const node of packed) {
      const i = index.get(node.nodeId);
      if (i == null) continue;
      nextNodes[i] = {
        ...node,
        bounds: { ...node.bounds, y: node.bounds.y + band.y + pad.top },
      };
    }
    bandByLane.set(laneId, band);
    cursorY += band.height;
  }

  if (!packedAny) return shareBandWidth(graph, nodes, groups, laneIds);

  const memberXs = nextNodes
    .filter((node) => {
      const owner = graph.nodes.find((item) => item.id === node.nodeId)?.groupId;
      return owner != null && laneIds.includes(owner);
    })
    .map((node) => node.bounds);
  const contentLeft =
    memberXs.length > 0 ? Math.min(...memberXs.map((box) => box.x)) : LAYOUT_MARGIN;
  const contentRight =
    memberXs.length > 0 ? Math.max(...memberXs.map((box) => box.x + box.width)) : contentLeft + 40;
  const bandLeft = contentLeft - SWIMLANE_HEADER_WIDTH;
  const bandRight = Math.max(contentRight + 40, bandLeft + SWIMLANE_HEADER_WIDTH + 40);

  const nested = computeGroupBounds(graph, nextNodes);
  const nestedById = new Map(nested.map((group) => [group.groupId, group]));
  const nextGroups = groups.map((group) => {
    if (laneIds.includes(group.groupId)) {
      const source = graph.groups.find((item) => item.id === group.groupId);
      const band = bandByLane.get(group.groupId);
      if (!band) return group;
      return paintLane(group, source, {
        x: bandLeft,
        y: band.y,
        width: bandRight - bandLeft,
        height: band.height,
      });
    }
    return nestedById.get(group.groupId) ?? group;
  });
  for (const nestedGroup of nested) {
    if (laneIds.includes(nestedGroup.groupId)) continue;
    if (nextGroups.some((group) => group.groupId === nestedGroup.groupId)) continue;
    nextGroups.push(nestedGroup);
  }

  return shiftIfNeeded(nextNodes, nextGroups);
}
