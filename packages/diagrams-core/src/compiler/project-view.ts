import type { Diagnostic, SourceRange } from "../types/geometry.ts";
import type { GraphEdge, GraphGroup, GraphNode, StyleDefinition } from "../types/graph.ts";
import type { ViewIntent } from "../types/view-intent.ts";
import type { CollapseAst, IntentBlockAst, StatementAst, ViewStatementAst } from "../parser/ast.ts";

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
  let visible = visibleNodeIds(allNodeIds, semantic.groups, includes, []);

  const hiddenByCollapse = new Set<string>();
  const summaryNodes: GraphNode[] = [];

  for (const collapse of collapses) {
    const memberIds = nodeIdsInGroup(collapse.groupId, semantic.groups);
    if (memberIds.size === 0) {
      diagnostics.push({
        severity: "warning",
        code: "FM226",
        message: `Collapse target group "${collapse.groupId}" has no member nodes`,
        range: collapse.range,
      });
      continue;
    }
    const visibleMembers = [...memberIds].filter((id) => visible.has(id));
    if (visibleMembers.length === 0) continue;
    for (const memberId of memberIds) {
      hiddenByCollapse.add(memberId);
      visible.delete(memberId);
    }
    visible.add(collapse.nodeId);
    const template = semantic.nodes.find((node) => visibleMembers.includes(node.id));
    const sourceGroup = semantic.groups.find((group) => group.id === collapse.groupId);
    const memberDescriptions = semantic.nodes
      .filter((node) => memberIds.has(node.id) && node.description)
      .map((node) => node.description!);
    const preferredMember =
      semantic.nodes.find(
        (node) => memberIds.has(node.id) && node.kind === "container" && node.id === "api",
      ) ?? semantic.nodes.find((node) => memberIds.has(node.id) && node.description);
    summaryNodes.push({
      id: collapse.nodeId,
      label: collapse.label ?? sourceGroup?.label ?? collapse.nodeId,
      labelAuthored: collapse.label != null || sourceGroup?.labelAuthored === true,
      kind: collapse.kind,
      groupId: sourceGroup?.parentId,
      styleRefs: template?.styleRefs ?? [],
      description: preferredMember?.description ?? memberDescriptions[0] ?? template?.description,
      technology: template?.technology,
      sourceRange: collapse.range,
    });
  }

  for (const nodeId of [...visible]) {
    if (excludes.some((selector) => matchesSelector(selector, nodeId, semantic.groups))) {
      visible.delete(nodeId);
    }
  }

  for (const hiddenId of hiddenByCollapse) visible.delete(hiddenId);

  const nodes = [
    ...semantic.nodes.filter((node) => visible.has(node.id)),
    ...summaryNodes.filter((node) => visible.has(node.id)),
  ];

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

  const visibleGroups = semantic.groups
    .filter((group) => group.nodeIds.some((nodeId) => nodeSet.has(nodeId)))
    .map((group) => ({
      ...group,
      nodeIds: group.nodeIds.filter((nodeId) => nodeSet.has(nodeId)),
    }));

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
