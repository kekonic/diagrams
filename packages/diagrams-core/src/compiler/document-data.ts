import type { Diagnostic, SourceRange } from "../types/geometry.ts";
import type { PropertyMap, StatementAst } from "../parser/ast.ts";
import { parseDocumentFields } from "../types/document-field.ts";
import type {
  DataStoreModel,
  GraphEdge,
  GraphGroup,
  GraphNode,
  NodeDataModel,
} from "../types/graph.ts";
import type { TableColumn } from "../types/table.ts";
import {
  STORE_PROFILE_NAMES,
  atomicBoundaryHint,
  atomicBoundaryMessage,
  crossPartitionHint,
  crossPartitionMessage,
  enforcementFits,
  firestorePartitionScopeMessage,
  missingPartitionKeyHint,
  missingPartitionKeyMessage,
  partitionFlagHint,
  partitionFlagMessage,
  rejectedPartitionMessage,
  resolveStoreProfile,
  scopeMismatchHint,
  storeIsPartitioned,
  type StoreProfile,
} from "./store-profile.ts";

export type InterpretedDocumentNode = {
  columns?: TableColumn[];
  forceTable: boolean;
  data?: NodeDataModel;
  generatedNote?: string;
  generatedSubtitle?: string;
  generatedDescription?: string;
};

const EMPTY_RANGE: SourceRange = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};

export function interpretDocumentNode(
  kind: string,
  properties: PropertyMap,
): InterpretedDocumentNode {
  const columns = parseDocumentFields(properties.fields);
  const hasFields = columns.length > 0;
  const data = readDataModel(kind, properties, hasFields);
  return {
    columns: hasFields ? columns : undefined,
    forceTable: kind === "document" && hasFields,
    data,
    generatedNote: data?.role === "document" ? data.idPattern : undefined,
    generatedSubtitle:
      data?.role === "document" && data.partition ? `partition ${data.partition}` : undefined,
    generatedDescription: describeDataNode(data),
  };
}

export function extractDataStore(statements: StatementAst[]): DataStoreModel {
  const store: DataStoreModel = {};
  for (const stmt of statements) {
    if (stmt.type !== "Directive" || stmt.value == null) continue;
    if (stmt.name === "profile") store.profile = String(stmt.value);
    if (stmt.name === "audience") store.audience = String(stmt.value);
    if (stmt.name === "partitioned") store.partitioned = isTrue(stmt.value);
  }
  return store;
}

export function applyDocumentData(input: {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  groups: GraphGroup[];
  diagnostics: Diagnostic[];
}): void {
  const nodes = [...input.nodes.values()];
  const byId = input.nodes;

  for (const node of nodes) {
    const data = node.data;
    if (!data) continue;
    const range = node.sourceRange ?? EMPTY_RANGE;
    if (data.role === "access" || data.role === "index") {
      link(input.edges, node, data.on, edgeLabel(data), range, byId, input.diagnostics);
    }
    if (data.role === "invariant") {
      if (data.on) link(input.edges, node, data.on, "invariant", range, byId, input.diagnostics);
      for (const span of data.spans ?? []) {
        link(input.edges, node, span, "invariant", range, byId, input.diagnostics);
      }
    }
  }

  diagnoseStores(input.groups, nodes, input.diagnostics);

  for (const node of nodes) {
    const data = node.data;
    if (!data) continue;
    const range = node.sourceRange ?? EMPTY_RANGE;
    if (data.role === "document") diagnoseDocument(node, input.groups, input.diagnostics, range);
    if (data.role === "access") diagnoseAccess(node, nodes, input.groups, input.diagnostics, range);
    if (data.role === "index") diagnoseIndex(node, nodes, input.diagnostics, range);
    if (data.role === "invariant")
      diagnoseInvariant(node, nodes, input.groups, input.diagnostics, range);
  }

  diagnoseAudiences(nodes, input.groups, input.diagnostics);
}

function readDataModel(
  kind: string,
  properties: PropertyMap,
  hasFields: boolean,
): NodeDataModel | undefined {
  if (kind === "document") {
    const idPattern = stringProp(properties, "idPattern");
    const partition = stringProp(properties, "partition");
    const audience = stringProp(properties, "audience");
    if (!hasFields && !idPattern && !partition && !audience) return undefined;
    return { role: "document", idPattern, partition, audience };
  }
  if (kind === "access") {
    return {
      role: "access",
      on: stringProp(properties, "on"),
      scope: accessScope(properties.scope),
      using: stringProp(properties, "using"),
      consistency: stringProp(properties, "consistency"),
      returns: stringProp(properties, "returns"),
      partition: stringProp(properties, "partition"),
    };
  }
  if (kind === "index") {
    return {
      role: "index",
      on: stringProp(properties, "on"),
      scope: indexScope(properties.scope),
      keys: stringList(properties.keys),
      partial: stringProp(properties, "partial"),
    };
  }
  if (kind === "invariant") {
    return {
      role: "invariant",
      on: stringProp(properties, "on"),
      spans: stringList(properties.spans),
      reads: readsOf(properties.reads),
      enforcement: enforcementOf(properties.enforcement),
    };
  }
  return undefined;
}

function diagnoseStores(groups: GraphGroup[], nodes: GraphNode[], diagnostics: Diagnostic[]): void {
  for (const group of groups) {
    if (group.kind !== "database") continue;
    const raw = group.dataStore?.profile;
    if (!raw) continue;
    const profile = resolveStoreProfile(raw);
    const range = databaseRange(group, nodes, groups);
    if (!profile) {
      diagnostics.push({
        severity: "warning",
        code: "DM202",
        message: `Database "${group.id}" profile "${raw}" has no constraint pack`,
        range,
        hint: `Known profiles: ${STORE_PROFILE_NAMES.join(", ")}.`,
      });
      continue;
    }
    const partitioned = group.dataStore?.partitioned === true;
    const contradicts =
      (profile.partitionMode === "always" && group.dataStore?.partitioned === false) ||
      (profile.partitionMode === "never" && partitioned);
    if (!contradicts) continue;
    const message = partitionFlagMessage(profile, group.id);
    if (!message) continue;
    diagnostics.push({
      severity: "warning",
      code: "DM201",
      message,
      range,
      hint: partitionFlagHint(profile),
    });
  }
}

function diagnoseDocument(
  node: GraphNode,
  groups: GraphGroup[],
  diagnostics: Diagnostic[],
  range: SourceRange,
): void {
  const data = node.data!;
  const database = owningDatabase(node, groups);
  const profile = resolveStoreProfile(database?.dataStore?.profile);
  diagnosePartitionField(node, data.partition, diagnostics, range);
  if (!profile) return;
  if (profile.partitionMode === "never") {
    if (data.partition) {
      diagnostics.push({
        severity: "warning",
        code: "DM201",
        message: rejectedPartitionMessage(profile, node.id),
        range,
        hint: "Remove partition and scope the access path by collection.",
      });
    }
    return;
  }
  const partitioned = storeIsPartitioned(profile, database?.dataStore?.partitioned);
  if (!partitioned) return;
  if (!data.partition) {
    diagnostics.push({
      severity: "warning",
      code: "DM201",
      message: missingPartitionKeyMessage(profile, node.id),
      range,
      hint: missingPartitionKeyHint(profile),
    });
  }
  if (!profile.partitionInDocumentId) return;
  if (!data.idPattern) {
    diagnostics.push({
      severity: "warning",
      code: "DM201",
      message: `Partitioned CouchDB document "${node.id}" has no _id pattern`,
      range,
      hint: 'CouchDB partitioned ids look like "{partition}:{docId}".',
    });
  } else if (data.partition && !idPatternIncludes(data.idPattern, data.partition)) {
    diagnostics.push({
      severity: "warning",
      code: "DM201",
      message: `Partitioned CouchDB document "${node.id}" does not place "${data.partition}" in its _id`,
      range,
      hint: `Include {${data.partition}} before the colon in idPattern.`,
    });
  }
}

function diagnosePartitionField(
  node: GraphNode,
  partition: string | undefined,
  diagnostics: Diagnostic[],
  range: SourceRange,
): void {
  if (!partition || !node.columns?.length) return;
  const field = node.columns.find((col) => col.name === partition);
  if (field?.roles?.includes("partition")) return;
  diagnostics.push({
    severity: "warning",
    code: "DM207",
    message: `Document "${node.id}" partition "${partition}" is not a partition field`,
    range,
    hint: `Mark that field with the partition role: ${partition}: string required partition`,
  });
}

function diagnoseAccess(
  node: GraphNode,
  nodes: GraphNode[],
  groups: GraphGroup[],
  diagnostics: Diagnostic[],
  range: SourceRange,
): void {
  const data = node.data!;
  const target = data.on ? nodes.find((item) => item.id === data.on) : undefined;
  const index = data.using ? nodes.find((item) => item.id === data.using) : undefined;
  const database = target ? owningDatabase(target, groups) : undefined;

  if (data.scope === "direct") return;

  const profile = resolveStoreProfile(database?.dataStore?.profile);
  if (profile?.crossPartition === "collection-group" && data.scope === "partition") {
    diagnostics.push({
      severity: "warning",
      code: "DM206",
      message: firestorePartitionScopeMessage(node.id),
      range,
      hint: "Use scope: direct for a document get. Leave scope unset for a collection query.",
    });
  }

  if (!data.using || !index || index.data?.role !== "index") {
    diagnostics.push({
      severity: "warning",
      code: "DM203",
      message: `Access "${node.id}" has no supporting index`,
      range,
      hint: "Point using at an index on the same document, or set scope: direct for an _id lookup.",
    });
    return;
  }
  if (index.data.on && data.on && index.data.on !== data.on) {
    diagnostics.push({
      severity: "warning",
      code: "DM203",
      message: `Access "${node.id}" uses index "${index.id}", which is on "${index.data.on}"`,
      range,
      hint: `Declare the index with on: ${data.on}.`,
    });
  }
  const indexScope = effectiveIndexScope(index, database);
  if (data.scope === "partition" && indexScope === "global") {
    diagnostics.push({
      severity: "warning",
      code: "DM209",
      message: `Access "${node.id}" expects a partition query but index "${index.id}" is global`,
      range,
    });
  }
  if (data.scope === "global" && indexScope === "partitioned") {
    diagnostics.push({
      severity: "warning",
      code: "DM209",
      message:
        profile?.name === "firestore"
          ? `Access "${node.id}" is a collection group query but index "${index.id}" covers one collection`
          : `Access "${node.id}" is global but index "${index.id}" only covers one partition`,
      range,
      hint: scopeMismatchHint(profile),
    });
  }
  diagnoseCrossPartition(node, data, profile, database, index, indexScope, diagnostics, range);
}

function diagnoseCrossPartition(
  node: GraphNode,
  data: NodeDataModel,
  profile: StoreProfile | undefined,
  database: GraphGroup | undefined,
  index: GraphNode | undefined,
  indexScope: "partitioned" | "global",
  diagnostics: Diagnostic[],
  range: SourceRange,
): void {
  if (!profile) return;
  const crosses = data.scope === "global" || (data.scope == null && indexScope === "global");
  if (!crosses) return;
  if (
    profile.crossPartition === "when-partitioned" &&
    !storeIsPartitioned(profile, database?.dataStore?.partitioned)
  ) {
    return;
  }
  const globalIndexId = index?.data?.scope === "global" ? index.id : undefined;
  diagnostics.push({
    severity: "warning",
    code: "DM206",
    message: crossPartitionMessage(profile, node.id, globalIndexId),
    range,
    hint: crossPartitionHint(profile, globalIndexId !== undefined),
  });
}

function diagnoseIndex(
  node: GraphNode,
  nodes: GraphNode[],
  diagnostics: Diagnostic[],
  range: SourceRange,
): void {
  const data = node.data!;
  const target = data.on ? nodes.find((item) => item.id === data.on) : undefined;
  if (!target?.columns?.length || !data.keys?.length) return;
  const names = new Set(target.columns.map((col) => col.name));
  for (const key of data.keys) {
    if (!names.has(key)) {
      diagnostics.push({
        severity: "warning",
        code: "DM208",
        message: `Index "${node.id}" key "${key}" is not a field of "${target.id}"`,
        range,
      });
    }
  }
}

function diagnoseInvariant(
  node: GraphNode,
  nodes: GraphNode[],
  groups: GraphGroup[],
  diagnostics: Diagnostic[],
  range: SourceRange,
): void {
  const data = node.data!;
  const spans = [...new Set([...(data.on ? [data.on] : []), ...(data.spans ?? [])])];
  const many = data.reads === "many" || (data.spans?.length ?? 0) > 1;
  const profiles = profilesFor(spans, nodes, groups);
  if (enforcementFits(profiles, data.enforcement, many)) return;
  diagnostics.push({
    severity: "warning",
    code: "DM204",
    message: atomicBoundaryMessage(node.id, data.enforcement, profiles),
    range,
    hint: atomicBoundaryHint(data.enforcement, profiles),
  });
}

function diagnoseAudiences(
  nodes: GraphNode[],
  groups: GraphGroup[],
  diagnostics: Diagnostic[],
): void {
  for (const group of groups) {
    if (!resolveStoreProfile(group.dataStore?.profile)?.databaseReadAudience) continue;
    const docs = nodes.filter(
      (node) => node.data?.role === "document" && owningDatabase(node, groups)?.id === group.id,
    );
    const declared = new Set<string>();
    if (group.dataStore?.audience) declared.add(group.dataStore.audience);
    for (const doc of docs) {
      if (doc.data?.audience) declared.add(doc.data.audience);
    }
    if (declared.size > 1) {
      diagnostics.push({
        severity: "warning",
        code: "DM205",
        message: `Database "${group.id}" mixes read audiences (${[...declared].sort().join(", ")})`,
        range: docs[0]?.sourceRange ?? EMPTY_RANGE,
        hint: "CouchDB members can read every document in a database. Split incompatible audiences into separate databases.",
      });
    }
  }
}

function link(
  edges: GraphEdge[],
  from: GraphNode,
  to: string | undefined,
  label: string,
  range: SourceRange,
  nodes: Map<string, GraphNode>,
  diagnostics: Diagnostic[],
): void {
  if (!to) return;
  if (!nodes.has(to)) {
    diagnostics.push({
      severity: "warning",
      code: "DM210",
      message: `${from.kind} "${from.id}" targets unknown node "${to}"`,
      range,
    });
    return;
  }
  if (edges.some((edge) => edge.from === from.id && edge.to === to)) return;
  edges.push({
    id: `data-${from.id}-${to}`,
    from: from.id,
    to,
    label,
    labelAuthored: true,
    kind: "dependency",
    arrows: "end",
    styleRefs: [],
    sourceRange: range,
  });
}

function edgeLabel(data: NodeDataModel): string {
  if (data.role === "access") {
    if (data.scope === "direct") return "id lookup";
    if (data.scope === "global") return "global query";
    if (data.scope === "partition") return "partition query";
    return "access";
  }
  if (data.scope === "global") return "global index";
  if (data.scope === "partitioned") return "partitioned index";
  return "index";
}

function describeDataNode(data: NodeDataModel | undefined): string | undefined {
  if (!data) return undefined;
  if (data.role === "access") {
    const scope =
      data.scope === "partition"
        ? "partition query"
        : data.scope === "global"
          ? "global query"
          : data.scope === "direct"
            ? "id lookup"
            : "access";
    const via = data.using ? ` via ${data.using}` : "";
    const consistency = data.consistency ? ` · ${data.consistency}` : "";
    return `${scope}${via}${consistency}`;
  }
  if (data.role === "index") {
    const scope =
      data.scope === "global"
        ? "global index"
        : data.scope === "partitioned"
          ? "partitioned index"
          : "index";
    const keys = data.keys?.length ? data.keys.join(", ") : "keys unset";
    return `${scope} · ${keys}`;
  }
  if (data.role === "invariant") {
    const how =
      data.enforcement === "application"
        ? "application enforced"
        : data.enforcement === "document"
          ? "one document"
          : data.enforcement === "partition"
            ? "one partition"
            : data.enforcement === "transaction"
              ? "transaction"
              : "enforcement unset";
    const reads = data.reads === "many" ? " · reads many" : "";
    return `${how}${reads}`;
  }
  return undefined;
}

function owningDatabase(node: GraphNode | undefined, groups: GraphGroup[]): GraphGroup | undefined {
  if (!node) return undefined;
  const byId = new Map(groups.map((group) => [group.id, group]));
  let current = node.groupId;
  while (current) {
    const group = byId.get(current);
    if (!group) return undefined;
    if (group.kind === "database") return group;
    current = group.parentId;
  }
  return undefined;
}

function profilesFor(ids: string[], nodes: GraphNode[], groups: GraphGroup[]): StoreProfile[] {
  const found = new Map<string, StoreProfile>();
  for (const id of ids) {
    const database = owningDatabase(
      nodes.find((item) => item.id === id),
      groups,
    );
    const profile = resolveStoreProfile(database?.dataStore?.profile);
    if (profile) found.set(profile.name, profile);
  }
  return [...found.values()];
}

function databaseRange(group: GraphGroup, nodes: GraphNode[], groups: GraphGroup[]): SourceRange {
  return (
    nodes.find((node) => owningDatabase(node, groups)?.id === group.id && node.sourceRange)
      ?.sourceRange ?? EMPTY_RANGE
  );
}

function effectiveIndexScope(
  index: GraphNode,
  database: GraphGroup | undefined,
): "partitioned" | "global" {
  if (index.data?.scope === "global") return "global";
  if (index.data?.scope === "partitioned") return "partitioned";
  const profile = resolveStoreProfile(database?.dataStore?.profile);
  if (profile?.crossPartition === "collection-group") return "partitioned";
  return storeIsPartitioned(profile, database?.dataStore?.partitioned) ? "partitioned" : "global";
}

function idPatternIncludes(pattern: string, partition: string): boolean {
  return pattern.includes(`{${partition}}`) || pattern.includes(partition);
}

function stringProp(properties: PropertyMap, key: string): string | undefined {
  const value = properties[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function stringList(value: PropertyMap[string]): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function accessScope(value: PropertyMap[string]): NodeDataModel["scope"] {
  const token = String(value ?? "").toLowerCase();
  if (token === "direct" || token === "id") return "direct";
  if (token === "partition" || token === "partitioned") return "partition";
  if (token === "global") return "global";
  return undefined;
}

function indexScope(value: PropertyMap[string]): NodeDataModel["scope"] {
  const token = String(value ?? "").toLowerCase();
  if (token === "global") return "global";
  if (token === "partition" || token === "partitioned") return "partitioned";
  return undefined;
}

function readsOf(value: PropertyMap[string]): NodeDataModel["reads"] {
  const token = String(value ?? "").toLowerCase();
  if (token === "many" || token === "multiple") return "many";
  if (token === "one" || token === "single") return "one";
  return undefined;
}

function enforcementOf(value: PropertyMap[string]): NodeDataModel["enforcement"] {
  const token = String(value ?? "").toLowerCase();
  if (token === "document" || token === "doc") return "document";
  if (token === "partition") return "partition";
  if (token === "transaction") return "transaction";
  if (token === "application" || token === "app") return "application";
  return undefined;
}

function isTrue(value: PropertyMap[string]): boolean {
  return value === true || value === "true" || value === "yes";
}
