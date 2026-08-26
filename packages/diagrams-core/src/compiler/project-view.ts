import type { Diagnostic, SourceRange } from "../types/geometry.ts";
import type { GraphEdge, GraphGroup, GraphNode, StyleDefinition } from "../types/graph.ts";
import type { ViewIntent } from "../types/view-intent.ts";
import type { CollapseAst, IntentBlockAst, StatementAst, ViewStatementAst } from "../parser/ast.ts";
import { getKindDefaults } from "./kinds.ts";

export type SemanticGraph = {
  id: string;
  title?: string;
  diagramKind: "flow" | "state";
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  styles: StyleDefinition[];
  diagnostics: Diagnostic[];
  intent?: ViewIntent;
  view?: { name: string; modelId: string; modelTitle?: string };
};

function stringList(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.length > 0) return [value];
  return undefined;
}

/** Map an `intent { … }` block to structured metadata. */
export function intentFromBlock(block: IntentBlockAst): ViewIntent {
  const props = block.properties;
  return {
    audience: props.audience != null ? String(props.audience) : undefined,
    question: props.question != null ? String(props.question) : undefined,
    scope: stringList(props.scope),
    omits: props.omits != null ? String(props.omits) : undefined,
    assumptions: props.assumptions != null ? String(props.assumptions) : undefined,
    evidence: stringList(props.evidence),
  };
}

export function extractIntentFromStatements(
  statements: Array<StatementAst | ViewStatementAst>,
): ViewIntent | undefined {
  const block = statements.find((stmt) => stmt.type === "IntentBlock") as
    | IntentBlockAst
    | undefined;
  if (!block) return undefined;
  const intent = intentFromBlock(block);
  return Object.values(intent).some((value) =>
    Array.isArray(value) ? value.length > 0 : value != null && value !== "",
  )
    ? intent
    : undefined;
}

export function collectViewScope(statements: ViewStatementAst[]): {
  includes: string[];
  excludes: string[];
  collapses: CollapseAst[];
} {
  const includes: string[] = [];
  const excludes: string[] = [];
  const collapses: CollapseAst[] = [];
  for (const stmt of statements) {
    if (stmt.type === "Include") includes.push(...stmt.selectors);
    if (stmt.type === "Exclude") excludes.push(...stmt.selectors);
    if (stmt.type === "Collapse") collapses.push(stmt);
  }
  return { includes, excludes, collapses };
}

function nodeIdsInGroup(groupId: string, groups: GraphGroup[]): Set<string> {
  const ids = new Set<string>();
  const queue = [groupId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    const group = groups.find((item) => item.id === current);
    if (!group) continue;
    for (const nodeId of group.nodeIds) ids.add(nodeId);
    for (const childId of group.childGroupIds) queue.push(childId);
  }
  return ids;
}

function matchesSelector(selector: string, nodeId: string, groups: GraphGroup[]): boolean {
  if (selector === "*") return true;
  if (selector.endsWith(".*")) {
    const prefix = selector.slice(0, -2);
    if (nodeId === prefix || nodeId.startsWith(`${prefix}.`)) return true;
    return nodeIdsInGroup(prefix, groups).has(nodeId);
  }
  if (groups.some((group) => group.id === selector)) {
    return nodeIdsInGroup(selector, groups).has(nodeId) || nodeId === selector;
  }
  return nodeId === selector;
}

function visibleNodeIds(
  allNodeIds: string[],
  groups: GraphGroup[],
  includes: string[],
  excludes: string[],
): Set<string> {
  let visible: Set<string>;
  if (includes.length === 0) {
    visible = new Set(allNodeIds);
  } else {
    visible = new Set<string>();
    for (const nodeId of allNodeIds) {
      if (includes.some((selector) => matchesSelector(selector, nodeId, groups))) {
        visible.add(nodeId);
      }
    }
  }
  for (const nodeId of [...visible]) {
    if (excludes.some((selector) => matchesSelector(selector, nodeId, groups))) {
      visible.delete(nodeId);
    }
  }
  return visible;
}

function groupSubtreeIds(rootId: string, groups: GraphGroup[]): Set<string> {
  const ids = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    if (ids.has(current)) continue;
    ids.add(current);
    const group = groups.find((item) => item.id === current);
    if (!group) continue;
    for (const childId of group.childGroupIds) queue.push(childId);
  }
  return ids;
}

/** Keep groups that still have visible nodes or visible descendant groups. */
function projectVisibleGroups(
  groups: GraphGroup[],
  nodeSet: Set<string>,
  summaryNodes: GraphNode[],
  collapsedGroupIds: Set<string>,
): GraphGroup[] {
  const hiddenGroups = new Set<string>();
  for (const groupId of collapsedGroupIds) {
    for (const id of groupSubtreeIds(groupId, groups)) hiddenGroups.add(id);
  }

  const summaryIdsByGroup = new Map<string, string[]>();
  for (const node of summaryNodes) {
    if (!node.groupId || !nodeSet.has(node.id)) continue;
    const list = summaryIdsByGroup.get(node.groupId) ?? [];
    list.push(node.id);
    summaryIdsByGroup.set(node.groupId, list);
  }

  const projected = groups
    .filter((group) => !hiddenGroups.has(group.id))
    .map((group) => {
      const nodeIds = [
        ...group.nodeIds.filter((nodeId) => nodeSet.has(nodeId)),
        ...(summaryIdsByGroup.get(group.id) ?? []),
      ];
      const childGroupIds = group.childGroupIds.filter((childId) => !hiddenGroups.has(childId));
      return { ...group, nodeIds, childGroupIds };
    });

  const byId = new Map(projected.map((group) => [group.id, group]));
  const keep = new Set<string>();

  for (const group of projected) {
    if (group.nodeIds.length > 0) keep.add(group.id);
  }

  // Promote parents that own region layout (grid/stack tracks) so zone children stay
  // nested. Skip empty decorative ancestors that only wrap another boundary.
  let grew = true;
  while (grew) {
    grew = false;
    for (const group of projected) {
      if (!keep.has(group.id) || !group.parentId || keep.has(group.parentId)) continue;
      const parent = byId.get(group.parentId);
      if (!parent) continue;
      if (parent.arrange != null || parent.columns != null || parent.rows != null) {
        keep.add(parent.id);
        grew = true;
      }
    }
  }

  return projected
    .filter((group) => keep.has(group.id))
    .map((group) => {
      const childGroupIds = group.childGroupIds.filter((childId) => keep.has(childId));
      const members = [
        ...group.nodeIds.map((id) => ({ kind: "node" as const, id })),
        ...childGroupIds.map((id) => ({ kind: "group" as const, id })),
      ];
      return {
        ...group,
        childGroupIds,
        members,
      };
    });
}

function collapseDescription(
  collapse: CollapseAst,
  memberIds: Set<string>,
  nodes: GraphNode[],
): string | undefined {
  const authored =
    collapse.properties.description != null && String(collapse.properties.description).length > 0
      ? String(collapse.properties.description)
      : undefined;
  if (authored) return authored;
  const firstDescribed = nodes.find((node) => memberIds.has(node.id) && node.description);
  return firstDescribed?.description;
}

function selectorResolves(selector: string, allNodeIds: string[], groups: GraphGroup[]): boolean {
  if (selector === "*") return true;
  if (groups.some((group) => group.id === selector)) return true;
  if (selector.endsWith(".*")) {
    const prefix = selector.slice(0, -2);
    if (groups.some((group) => group.id === prefix)) return true;
    if (allNodeIds.some((id) => id === prefix || id.startsWith(`${prefix}.`))) return true;
    return false;
  }
  return allNodeIds.includes(selector);
}

function warnUnresolvedSelectors(
  viewStatements: ViewStatementAst[],
  allNodeIds: string[],
  groups: GraphGroup[],
  diagnostics: Diagnostic[],
): void {
  for (const stmt of viewStatements) {
    if (stmt.type !== "Include" && stmt.type !== "Exclude") continue;
    const kind = stmt.type === "Include" ? "include" : "exclude";
    for (const selector of stmt.selectors) {
      if (selectorResolves(selector, allNodeIds, groups)) continue;
      diagnostics.push({
        severity: "warning",
        code: "FM233",
        message: `${kind} selector "${selector}" matches no nodes or groups`,
        range: stmt.range,
        hint: "Use a bare id, a group id, `prefix.*`, or `*`.",
      });
    }
  }
}

/** Project a semantic graph through view scope rules into a renderable graph. */
export function projectSemanticGraph(
  semantic: SemanticGraph,
  viewStatements: ViewStatementAst[],
  options: {
    viewName: string;
    modelId: string;
    modelTitle?: string;
    intent?: ViewIntent;
    range: SourceRange;
  },
): SemanticGraph {
  const diagnostics = [...semantic.diagnostics];
  const { includes, excludes, collapses } = collectViewScope(viewStatements);
  const allNodeIds = semantic.nodes.map((node) => node.id);
  warnUnresolvedSelectors(viewStatements, allNodeIds, semantic.groups, diagnostics);
  let visible = visibleNodeIds(allNodeIds, semantic.groups, includes, []);

  const hiddenByCollapse = new Set<string>();
  const collapsedGroupIds = new Set<string>();
  const summaryNodes: GraphNode[] = [];
  const reservedIds = new Set(allNodeIds);

  for (const collapse of collapses) {
    const groupExists = semantic.groups.some((group) => group.id === collapse.groupId);
    const memberIds = nodeIdsInGroup(collapse.groupId, semantic.groups);
    if (!groupExists) {
      diagnostics.push({
        severity: "warning",
        code: "FM226",
        message: `Collapse target "${collapse.groupId}" is not a group`,
        range: collapse.range,
        hint: "Collapse a `group`, `boundary`, `zone`, or `swimlane` id from the model.",
      });
      continue;
    }
    if (memberIds.size === 0) {
      diagnostics.push({
        severity: "warning",
        code: "FM226",
        message: `Collapse target group "${collapse.groupId}" has no member nodes`,
        range: collapse.range,
      });
      continue;
    }
    if (reservedIds.has(collapse.nodeId)) {
      diagnostics.push({
        severity: "error",
        code: "FM234",
        message: `Collapse summary id "${collapse.nodeId}" already exists in the model`,
        range: collapse.range,
        hint: "Choose a summary id that does not collide with a model node.",
      });
      continue;
    }
    const visibleMembers = [...memberIds].filter((id) => visible.has(id));
    if (visibleMembers.length === 0) continue;
    collapsedGroupIds.add(collapse.groupId);
    for (const memberId of memberIds) {
      hiddenByCollapse.add(memberId);
      visible.delete(memberId);
    }
    visible.add(collapse.nodeId);
    reservedIds.add(collapse.nodeId);
    const sourceGroup = semantic.groups.find((group) => group.id === collapse.groupId);
    const { defaults } = getKindDefaults(collapse.kind);
    const authoredTech =
      collapse.properties.technology != null && String(collapse.properties.technology).length > 0
        ? String(collapse.properties.technology)
        : undefined;
    const orderNode = semantic.nodes.find((node) => visibleMembers.includes(node.id));
    summaryNodes.push({
      id: collapse.nodeId,
      label: collapse.label ?? sourceGroup?.label ?? collapse.nodeId,
      labelAuthored: collapse.label != null || sourceGroup?.labelAuthored === true,
      kind: collapse.kind,
      shape: defaults.shape,
      groupId: sourceGroup?.parentId,
      styleRefs: [],
      showSubtitle: false,
      description: collapseDescription(collapse, memberIds, semantic.nodes),
      technology: authoredTech,
      minWidth: defaults.defaultMinWidth,
      maxWidth: defaults.defaultMaxWidth,
      depth: defaults.defaultDepth,
      // Use the collapsed subtree's declaration site so considerModelOrder keeps
      // the summary where the group lived, not where the view `collapse` line is.
      sourceRange: orderNode?.sourceRange ?? collapse.range,
    });
  }

  for (const nodeId of [...visible]) {
    if (excludes.some((selector) => matchesSelector(selector, nodeId, semantic.groups))) {
      visible.delete(nodeId);
    }
  }

  for (const hiddenId of hiddenByCollapse) visible.delete(hiddenId);

  const summaryById = new Map(
    summaryNodes.filter((node) => visible.has(node.id)).map((node) => [node.id, node]),
  );
  const nodes: GraphNode[] = [];
  const emitted = new Set<string>();
  for (const node of semantic.nodes) {
    if (hiddenByCollapse.has(node.id)) {
      for (const collapse of collapses) {
        if (!summaryById.has(collapse.nodeId) || emitted.has(collapse.nodeId)) continue;
        const members = nodeIdsInGroup(collapse.groupId, semantic.groups);
        if (!members.has(node.id)) continue;
        nodes.push(summaryById.get(collapse.nodeId)!);
        emitted.add(collapse.nodeId);
      }
      continue;
    }
    if (!visible.has(node.id) || emitted.has(node.id)) continue;
    nodes.push(node);
    emitted.add(node.id);
  }
  for (const summary of summaryById.values()) {
    if (!emitted.has(summary.id)) nodes.push(summary);
  }

  const nodeSet = new Set(nodes.map((node) => node.id));
  const remapEndpoint = (nodeId: string): string | undefined => {
    if (nodeSet.has(nodeId)) return nodeId;
    for (const collapse of collapses) {
      const members = nodeIdsInGroup(collapse.groupId, semantic.groups);
      if (members.has(nodeId) && nodeSet.has(collapse.nodeId)) return collapse.nodeId;
    }
    return undefined;
  };

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const edge of semantic.edges) {
    const from = remapEndpoint(edge.from);
    const to = remapEndpoint(edge.to);
    if (!from || !to || from === to) continue;
    const key = `${from}|${to}|${edge.label ?? ""}|${edge.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ ...edge, from, to });
  }

  const visibleGroups = projectVisibleGroups(
    semantic.groups,
    nodeSet,
    summaryNodes,
    collapsedGroupIds,
  );

  return {
    id: `${options.modelId}-${slugify(options.viewName)}`,
    title: options.viewName,
    diagramKind: semantic.diagramKind,
    nodes,
    edges,
    groups: visibleGroups,
    styles: semantic.styles,
    diagnostics,
    intent: options.intent,
    view: {
      name: options.viewName,
      modelId: options.modelId,
      modelTitle: options.modelTitle,
    },
  };
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "view"
  );
}
