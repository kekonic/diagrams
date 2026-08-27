import type { Diagnostic, SourceRange } from "../types/geometry.ts";
import type { GraphEdge, GraphGroup, GraphNode, StyleDefinition } from "../types/graph.ts";
import type { ViewStatementAst } from "../parser/ast.ts";

export type SemanticGraph = {
  id: string;
  title?: string;
  diagramKind: "flow" | "state";
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  styles: StyleDefinition[];
  diagnostics: Diagnostic[];
  view?: { name: string; modelId: string; modelTitle?: string };
};

export function collectViewScope(statements: ViewStatementAst[]): {
  includes: string[];
  excludes: string[];
} {
  const includes: string[] = [];
  const excludes: string[] = [];
  for (const stmt of statements) {
    if (stmt.type === "Include") includes.push(...stmt.selectors);
    if (stmt.type === "Exclude") excludes.push(...stmt.selectors);
  }
  return { includes, excludes };
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
  for (const nodeId of visible) {
    if (excludes.some((selector) => matchesSelector(selector, nodeId, groups))) {
      visible.delete(nodeId);
    }
  }
  return visible;
}

/** Keep groups that still have visible nodes or visible descendant groups. */
function projectVisibleGroups(groups: GraphGroup[], nodeSet: Set<string>): GraphGroup[] {
  const projected = groups.map((group) => {
    const nodeIds = group.nodeIds.filter((nodeId) => nodeSet.has(nodeId));
    return { ...group, nodeIds, childGroupIds: [...group.childGroupIds] };
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

  // Drop groups with no kept descendants and no nodes.
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of projected) {
      if (!keep.has(group.id)) continue;
      const childGroupIds = group.childGroupIds.filter((childId) => keep.has(childId));
      if (group.nodeIds.length === 0 && childGroupIds.length === 0) {
        keep.delete(group.id);
        changed = true;
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
    range: SourceRange;
  },
): SemanticGraph {
  const diagnostics = [...semantic.diagnostics];
  const { includes, excludes } = collectViewScope(viewStatements);
  const allNodeIds = semantic.nodes.map((node) => node.id);
  warnUnresolvedSelectors(viewStatements, allNodeIds, semantic.groups, diagnostics);
  const visible = visibleNodeIds(allNodeIds, semantic.groups, includes, excludes);
  const nodes = semantic.nodes.filter((node) => visible.has(node.id));
  const nodeSet = new Set(nodes.map((node) => node.id));

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const edge of semantic.edges) {
    if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to) || edge.from === edge.to) continue;
    const key = `${edge.from}|${edge.to}|${edge.label ?? ""}|${edge.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push(edge);
  }

  const visibleGroups = projectVisibleGroups(semantic.groups, nodeSet);

  return {
    id: `${options.modelId}-${slugify(options.viewName)}`,
    title: options.viewName,
    diagramKind: semantic.diagramKind,
    nodes,
    edges,
    groups: visibleGroups,
    styles: semantic.styles,
    diagnostics,
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
