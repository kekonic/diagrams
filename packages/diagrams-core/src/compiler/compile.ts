import type { Diagnostic } from "../types/geometry.ts";
import type {
  CompileResult,
  CellArrange,
  Density,
  EdgeKind,
  GraphEdge,
  GraphGroup,
  GraphModel,
  GraphNode,
  LayoutOptions,
  RegionAlign,
  RegionArrange,
  RenderOptions,
  RoutingOptions,
  StyleDefinition,
  TrackSpec,
} from "../types/graph.ts";
import {
  mergePresentationOptions,
  presentationFromProperties,
  REMOVED_PRESENTATION_PROPS,
  type PresentationOptions,
} from "../types/presentation.ts";
import type { SourceRange } from "../types/geometry.ts";
import { classifyBranch, normalizeBranch } from "../types/branch.ts";
import { fkCardinality, isPureCardinalityLabel, parseCardinality } from "../types/cardinality.ts";
import { findColumnIndex, parseTableColumns } from "../types/table.ts";
import type {
  DiagramAst,
  EdgeAst,
  KDiagramAst,
  StatementAst,
  AnimationBlockAst,
} from "../parser/ast.ts";
import { getKindDefaults, BUILTIN_KIND_LIST } from "./kinds.ts";
import { normalizeDirection } from "./direction.ts";
import { isKnownShapeId, normalizeShapeId } from "../types/shapes.ts";
import { isGroupChromeShapeId, normalizeGroupChromeShapeId } from "../types/shapes.ts";
import { compileAnimationBlocks } from "./compile-animations.ts";
import { compileSequence } from "./compile-sequence.ts";

function suggestKindName(kind: string): string | undefined {
  const target = kind.toLowerCase();
  let best: string | undefined;
  let bestDist = 3;
  for (const candidate of BUILTIN_KIND_LIST) {
    const d = levenshtein(target, candidate.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

function collectStyleRefsFromProperties(properties: Record<string, unknown>): string[] {
  const refs: string[] = [];
  const styles = properties.styles;
  if (Array.isArray(styles)) {
    for (const s of styles) refs.push(String(s));
  }
  return refs;
}

function collectUnresolvedVars(
  properties: Record<string, unknown>,
): Record<string, string> | undefined {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(properties)) {
    if (k.startsWith("--")) vars[k] = String(v);
  }
  return Object.keys(vars).length ? vars : undefined;
}

function edgeOpToKind(op: EdgeAst["op"]): EdgeKind {
  switch (op) {
    case "=>":
    case "<=":
      return "async";
    case "~>":
    case "<~":
      return "eventual";
    case "..>":
    case "<..":
    case "-->":
      return "dependency";
    case "-x":
    case "x-":
      return "failure";
    case "--":
      return "association";
    default:
      return "sync";
  }
}

/** Reverse ops are authored target-first; compile swaps endpoints so routing stays from→to. */
function edgeOpIsReverse(op: EdgeAst["op"]): boolean {
  return op === "<-" || op === "<=" || op === "<.." || op === "x-" || op === "<~";
}

function edgeOpArrows(op: EdgeAst["op"]): GraphEdge["arrows"] {
  if (op === "<->") return "both";
  if (op === "--") return "none";
  return "end";
}

function normalizePriority(value: unknown): GraphEdge["priority"] | undefined {
  if (value === "low" || value === "normal" || value === "high") return value;
  return undefined;
}

/** Along-path label bias — `labelPosition` or alias `labelAt`. */
function normalizeLabelPosition(value: unknown): GraphEdge["labelPosition"] | undefined {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return undefined;
  }
  const raw = String(value).trim().toLowerCase();
  if (raw === "start" || raw === "begin" || raw === "source") return "start";
  if (raw === "middle" || raw === "mid" || raw === "center") return "middle";
  if (raw === "end" || raw === "target") return "end";
  return undefined;
}

function normalizeGroupLayout(value: unknown): LayoutOptions["groupLayout"] | undefined {
  if (value === "auto" || value === "flat" || value === "compound" || value === "swimlane") {
    return value;
  }
  return undefined;
}

/** Normalize DSL nodePlacement to public values (no obscure ELK nicknames). */
function normalizeNodePlacement(value: unknown): LayoutOptions["nodePlacement"] | undefined {
  switch (value) {
    case "straight":
    case "balanced":
    case "basic":
      return value;
    default:
      return undefined;
  }
}

function normalizeDensity(value: unknown): Density | undefined {
  if (value === "compact" || value === "normal" || value === "spacious") return value;
  return undefined;
}

function isRemovedDensityAlias(value: unknown): boolean {
  return value === "mid" || value === "comfortable" || value === "roomy";
}

/** Prefer `gaps`; accept singular `gap`. */
function normalizeCrossings(value: unknown): RoutingOptions["crossings"] | undefined {
  if (value === "none" || value === "gaps" || value === "jumps" || value === "smart") return value;
  if (value === "gap") return "gaps";
  return undefined;
}

function normalizeBool(value: unknown): boolean | undefined {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Presentation scale — clamp so layout stays sane. */
function normalizeScale(value: unknown): number | undefined {
  const n = optionalNumber(value);
  if (n == null || n <= 0) return undefined;
  return Math.min(2, Math.max(0.75, n));
}

function collectStatements(
  statements: StatementAst[],
  ctx: {
    nodes: Map<string, GraphNode>;
    edges: GraphEdge[];
    groups: GraphGroup[];
    styles: StyleDefinition[];
    diagnostics: Diagnostic[];
    groupStack: string[];
    edgeCounter: number;
    pendingGroupMembers: Array<{
      nodeId: string;
      groupId: string;
      range: import("../types/geometry.ts").SourceRange;
    }>;
  },
): void {
  for (const stmt of statements) {
    switch (stmt.type) {
      case "Node": {
        if (ctx.nodes.has(stmt.id)) {
          ctx.diagnostics.push({
            severity: "error",
            code: "FM101",
            message: `Duplicate node id "${stmt.id}"`,
            range: stmt.range,
          });
          break;
        }
        const { defaults, isBuiltin } = getKindDefaults(stmt.kind);
        if (!isBuiltin) {
          const suggestion = suggestKindName(stmt.kind);
          ctx.diagnostics.push({
            severity: "warning",
            code: "FM102",
            message: `Unknown node kind "${stmt.kind}" — using generic defaults`,
            range: stmt.range,
            hint: suggestion
              ? `Did you mean "${suggestion}"?`
              : "See built-in kinds (service, database, event, process, …) or keep an open kind.",
          });
        }
        const columns = parseTableColumns(stmt.properties.columns);
        const hasErdColumns = columns.length > 0;
        const rawShape = stmt.properties.shape != null ? String(stmt.properties.shape) : undefined;
        const shapeOverride = rawShape ? normalizeShapeId(rawShape) : undefined;
        if (rawShape && !isKnownShapeId(shapeOverride)) {
          ctx.diagnostics.push({
            severity: "warning",
            code: "FM111",
            message: `Unknown shape "${rawShape}" — rendering falls back to rounded unless a custom shape is registered`,
            range: stmt.range,
            hint: `Known shapes: rectangle, rounded, pill, diamond, hexagon, cylinder, queue, cloud, document, …`,
          });
        }
        // Tables/entities with columns become ERD cards unless the author overrides shape.
        // Kind capability `erd-table` marks kinds that participate in this rule.
        const erdKind =
          defaults.capabilities.includes("erd-table") ||
          stmt.kind === "table" ||
          stmt.kind === "entity";
        const shape = shapeOverride ?? (hasErdColumns && erdKind ? "table" : defaults.shape);
        const styleRefs = [...collectStyleRefsFromProperties(stmt.properties), ...stmt.styleRefs];
        const unresolvedVars = {
          ...defaults.cssVars,
          ...collectUnresolvedVars(stmt.properties),
        };
        const erdMinWidth = hasErdColumns
          ? Math.max(defaults.defaultMinWidth, 200)
          : defaults.defaultMinWidth;
        const erdMaxWidth = hasErdColumns
          ? Math.max(defaults.defaultMaxWidth, 360)
          : defaults.defaultMaxWidth;
        // Icons: author `icon: …`, `icon: none` to suppress, else kind catalog default.
        // Person silhouettes already have a head glyph — skip catalog defaults there.
        const rawIcon = stmt.properties.icon != null ? String(stmt.properties.icon) : undefined;
        const icon =
          rawIcon === "none"
            ? undefined
            : rawIcon !== undefined
              ? rawIcon
              : shape === "person"
                ? undefined
                : defaults.icon;
        const authoredPaint =
          stmt.properties.iconPaint != null
            ? String(stmt.properties.iconPaint).toLowerCase()
            : undefined;
        const iconPaint =
          authoredPaint === "theme" || authoredPaint === "brand" ? authoredPaint : undefined;
        const iconColor =
          stmt.properties.iconColor != null && String(stmt.properties.iconColor).length > 0
            ? String(stmt.properties.iconColor)
            : undefined;
        const rawSide =
          stmt.properties.side != null ? String(stmt.properties.side).toLowerCase() : undefined;
        const side =
          rawSide === "west" || rawSide === "east" || rawSide === "north" || rawSide === "south"
            ? rawSide
            : undefined;
        if (rawSide && !side) {
          ctx.diagnostics.push({
            severity: "warning",
            code: "FM115",
            message: `Unknown side "${rawSide}" — use west, east, north, or south`,
            range: stmt.range,
            hint: "side is a surround layout hint for satellite nodes.",
          });
        }
        const nodeVars = {
          ...unresolvedVars,
          ...(iconColor ? { "--icon-color": iconColor } : {}),
        };
        const parentGroupId = ctx.groupStack.at(-1);
        ctx.nodes.set(stmt.id, {
          id: stmt.id,
          label: stmt.label ?? stmt.id,
          labelAuthored: stmt.label != null,
          kind: stmt.kind,
          shape,
          icon,
          iconPaint,
          iconColor,
          side,
          groupId: parentGroupId,
          styleRefs,
          unresolvedVars: Object.keys(nodeVars).length ? nodeVars : undefined,
          note: stmt.properties.note != null ? String(stmt.properties.note) : undefined,
          // subtitle: true → show kind eyebrow; subtitle: "…" → authored caption.
          showSubtitle: stmt.properties.subtitle === true,
          subtitle:
            typeof stmt.properties.subtitle === "string" && stmt.properties.subtitle.length > 0
              ? String(stmt.properties.subtitle)
              : undefined,
          technology:
            stmt.properties.technology != null && String(stmt.properties.technology).length > 0
              ? String(stmt.properties.technology)
              : undefined,
          description:
            stmt.properties.description != null && String(stmt.properties.description).length > 0
              ? String(stmt.properties.description)
              : undefined,
          columns: hasErdColumns ? columns : undefined,
          minWidth: (stmt.properties.minWidth as number) ?? erdMinWidth,
          maxWidth: (stmt.properties.maxWidth as number) ?? erdMaxWidth,
          depth: (stmt.properties.depth as number) ?? defaults.defaultDepth,
          scale: normalizeScale(stmt.properties.scale),
          sourceRange: stmt.range,
        });
        if (parentGroupId) {
          const parent = ctx.groups.find((g) => g.id === parentGroupId);
          parent?.members?.push({ kind: "node", id: stmt.id });
        }
        break;
      }
      case "Edge": {
        ctx.edgeCounter++;
        const fromColumn =
          stmt.fromColumn ??
          (stmt.properties.fromColumn != null
            ? String(stmt.properties.fromColumn)
            : stmt.properties.fromCol != null
              ? String(stmt.properties.fromCol)
              : undefined);
        const toColumn =
          stmt.toColumn ??
          (stmt.properties.toColumn != null
            ? String(stmt.properties.toColumn)
            : stmt.properties.toCol != null
              ? String(stmt.properties.toCol)
              : undefined);
        const cardinality =
          parseCardinality(stmt.properties.cardinality ?? stmt.properties.rel) ??
          parseCardinality(stmt.label) ??
          (fromColumn || toColumn
            ? { from: "one" as const, to: "zeroOrMany" as const }
            : undefined);
        // Pure cardinality labels ("1:N") are relationship markers, not branch cues.
        const branch =
          normalizeBranch(stmt.properties.branch) ??
          (cardinality && isPureCardinalityLabel(stmt.label)
            ? undefined
            : classifyBranch(stmt.label));
        const identifying = normalizeBool(stmt.properties.identifying);
        const rawIcon = stmt.properties.icon != null ? String(stmt.properties.icon) : undefined;
        const icon = rawIcon && rawIcon !== "none" ? rawIcon : undefined;
        const authoredPaint =
          stmt.properties.iconPaint != null
            ? String(stmt.properties.iconPaint).toLowerCase()
            : undefined;
        const iconPaint =
          authoredPaint === "theme" || authoredPaint === "brand" ? authoredPaint : undefined;
        const iconColor =
          stmt.properties.iconColor != null && String(stmt.properties.iconColor).length > 0
            ? String(stmt.properties.iconColor)
            : undefined;
        const reverse = edgeOpIsReverse(stmt.op);
        const arrowsProp = String(stmt.properties.arrows ?? "").toLowerCase();
        const arrows: GraphEdge["arrows"] =
          arrowsProp === "both" ||
          arrowsProp === "start" ||
          arrowsProp === "end" ||
          arrowsProp === "none"
            ? arrowsProp
            : edgeOpArrows(stmt.op);
        ctx.edges.push({
          id: `e${ctx.edgeCounter}`,
          from: reverse ? stmt.to : stmt.from,
          to: reverse ? stmt.from : stmt.to,
          fromColumn: reverse ? toColumn : fromColumn,
          toColumn: reverse ? fromColumn : toColumn,
          label: stmt.label,
          labelAuthored: stmt.label != null,
          kind: edgeOpToKind(stmt.op),
          arrows,
          styleRefs: [...collectStyleRefsFromProperties(stmt.properties), ...stmt.styleRefs],
          icon,
          iconPaint,
          iconColor,
          priority: normalizePriority(stmt.properties.priority),
          labelPosition: normalizeLabelPosition(
            stmt.properties.labelPosition ?? stmt.properties.labelAt,
          ),
          branch,
          cardinality,
          identifying: identifying ?? undefined,
          sourceRange: stmt.range,
        });
        break;
      }
      case "Group": {
        const groupId = stmt.id ?? `group_${ctx.groups.length + 1}`;
        const hints = extractGroupArrangeHints(stmt.statements);
        if (hints.shapeDiagnostic) ctx.diagnostics.push(hints.shapeDiagnostic);
        const rawIcon = hints.icon;
        const icon = rawIcon && rawIcon !== "none" ? rawIcon : undefined;
        const group: GraphGroup = {
          id: groupId,
          label: stmt.label ?? groupId,
          labelAuthored: stmt.label != null,
          kind: stmt.groupKind,
          parentId: ctx.groupStack.at(-1),
          nodeIds: [],
          childGroupIds: [],
          members: [],
          styleRefs: [],
          paddingHint: hints.paddingHint,
          chrome: hints.chrome,
          shape: hints.shape,
          icon,
          iconPaint: hints.iconPaint,
          iconColor: hints.iconColor,
          arrange: hints.arrange,
          align: hints.align,
          gap: hints.gap,
          columns: hints.columns,
          rows: hints.rows,
          column: hints.column,
          row: hints.row,
          span: hints.span,
          colSpan: hints.colSpan,
          rowSpan: hints.rowSpan,
          cellArrange: hints.cellArrange,
        };
        if (ctx.groupStack.length > 0) {
          const parent = ctx.groups.find((g) => g.id === ctx.groupStack.at(-1));
          parent?.childGroupIds.push(groupId);
          parent?.members?.push({ kind: "group", id: groupId });
        }
        ctx.groups.push(group);
        ctx.groupStack.push(groupId);
        collectStatements(stmt.statements, ctx);
        for (const n of ctx.nodes.values()) {
          if (n.groupId === groupId && !group.nodeIds.includes(n.id)) {
            group.nodeIds.push(n.id);
          }
        }
        // `arrange: stack` on a leaf (nodes only) means in-cell stack, not region tracks.
        if (
          group.arrange === "stack" &&
          group.childGroupIds.length === 0 &&
          group.cellArrange == null
        ) {
          group.cellArrange = "stack";
          group.arrange = undefined;
        }
        ctx.groupStack.pop();
        break;
      }
      case "Style": {
        const props: Record<string, string> = {};
        for (const [k, v] of Object.entries(stmt.properties)) {
          props[k] = String(v);
        }
        ctx.styles.push({ name: stmt.name, target: stmt.target, properties: props });
        break;
      }
      case "StyleRef": {
        const styleDef = ctx.styles.find((s) => s.name === stmt.styleName);
        for (const id of stmt.targetIds) {
          const node = ctx.nodes.get(id);
          if (node) {
            if (!node.styleRefs.includes(stmt.styleName)) node.styleRefs.push(stmt.styleName);
          } else {
            ctx.diagnostics.push({
              severity: "warning",
              code: "FM105",
              message:
                styleDef?.target === "edge"
                  ? `Style "${stmt.styleName}" targets edges — use \`a -> b is ${stmt.styleName}\` or styles: […] on the edge`
                  : `Style ref "${stmt.styleName}" references unknown node "${id}"`,
              range: stmt.range,
            });
          }
        }
        break;
      }
      case "GroupMember": {
        const groupId = ctx.groupStack.at(-1);
        if (!groupId) break;
        const group = ctx.groups.find((g) => g.id === groupId);
        for (const nodeId of stmt.nodeIds) {
          const node = ctx.nodes.get(nodeId);
          if (node) {
            node.groupId = groupId;
            if (group && !group.nodeIds.includes(nodeId)) group.nodeIds.push(nodeId);
            if (group && !group.members?.some((m) => m.kind === "node" && m.id === nodeId)) {
              group.members?.push({ kind: "node", id: nodeId });
            }
          } else {
            ctx.pendingGroupMembers.push({ nodeId, groupId, range: stmt.range });
          }
        }
        break;
      }
      default:
        break;
    }
  }
}

function extractGroupPaddingHint(statements: StatementAst[]): string | undefined {
  for (const stmt of statements) {
    if (stmt.type === "Directive" && stmt.name === "padding" && stmt.value != null) {
      return String(stmt.value);
    }
  }
  return undefined;
}

type GroupArrangeHints = {
  paddingHint?: string;
  chrome?: boolean;
  shape?: string;
  icon?: string;
  iconPaint?: "theme" | "brand";
  iconColor?: string;
  arrange?: RegionArrange;
  align?: RegionAlign;
  gap?: string | number;
  columns?: TrackSpec;
  rows?: TrackSpec;
  column?: number | string;
  row?: number | string;
  span?: number;
  colSpan?: number;
  rowSpan?: number;
  cellArrange?: CellArrange;
  shapeDiagnostic?: Diagnostic;
};

function normalizeGroupChrome(value: unknown): boolean | undefined {
  if (value === true || value === "true" || value === "on") return true;
  if (value === false || value === "false" || value === "none" || value === "off") return false;
  return undefined;
}

function normalizeRegionArrange(value: unknown): RegionArrange | undefined {
  if (value === "stack" || value === "row" || value === "grid" || value === "surround") {
    return value;
  }
  return undefined;
}

function normalizeRegionAlign(value: unknown): RegionAlign | undefined {
  if (value === "stretch" || value === "start" || value === "center" || value === "end") {
    return value;
  }
  return undefined;
}

function normalizeCellArrange(value: unknown): CellArrange | undefined {
  if (value === "flow" || value === "pack" || value === "stack") return value;
  return undefined;
}

function normalizeTrackSpec(value: unknown): TrackSpec | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
    return undefined;
  }
  if (Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string")) {
    return value.map(String);
  }
  return undefined;
}

function normalizeTrackRef(value: unknown): number | string | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 1 && String(n) === value.trim()) return Math.floor(n);
    if (value.trim()) return value.trim();
  }
  return undefined;
}

function normalizePositiveInt(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

function normalizeGap(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
    const named = value.trim();
    if (named === "compact" || named === "normal" || named === "spacious") return named;
    return undefined;
  }
  return undefined;
}

function extractGroupArrangeHints(statements: StatementAst[]): GroupArrangeHints {
  const hints: GroupArrangeHints = {
    paddingHint: extractGroupPaddingHint(statements),
  };
  for (const stmt of statements) {
    if (stmt.type !== "Directive" || stmt.value == null) continue;
    switch (stmt.name) {
      case "chrome": {
        const chrome = normalizeGroupChrome(stmt.value);
        if (chrome != null) hints.chrome = chrome;
        break;
      }
      case "shape": {
        const raw = String(stmt.value);
        const normalized = normalizeGroupChromeShapeId(raw);
        if (!isGroupChromeShapeId(raw)) {
          hints.shapeDiagnostic = {
            severity: "warning",
            code: "FM113",
            message: `Unsupported group shape "${raw}" — using rectangle chrome`,
            range: stmt.range,
            hint: "Group chrome shapes: rectangle, rounded, hexagon, circle, ellipse.",
          };
          hints.shape = "rectangle";
        } else {
          hints.shape = normalized;
        }
        break;
      }
      case "icon": {
        hints.icon = String(stmt.value);
        break;
      }
      case "iconPaint": {
        const paint = String(stmt.value).toLowerCase();
        if (paint === "theme" || paint === "brand") hints.iconPaint = paint;
        break;
      }
      case "iconColor": {
        const color = String(stmt.value).trim();
        if (color.length > 0) hints.iconColor = color;
        break;
      }
      case "arrange": {
        // Parent track arrange vs in-cell arrange: stack|row|grid are region;
        // flow|pack are cell-only; bare `stack` on a leaf with no children is cell.
        const region = normalizeRegionArrange(stmt.value);
        const cell = normalizeCellArrange(stmt.value);
        if (region) hints.arrange = region;
        else if (cell) hints.cellArrange = cell;
        break;
      }
      case "align": {
        const align = normalizeRegionAlign(stmt.value);
        if (align) hints.align = align;
        break;
      }
      case "gap": {
        const gap = normalizeGap(stmt.value);
        if (gap != null) hints.gap = gap;
        break;
      }
      case "columns": {
        const tracks = normalizeTrackSpec(stmt.value);
        if (tracks != null) hints.columns = tracks;
        break;
      }
      case "rows": {
        const tracks = normalizeTrackSpec(stmt.value);
        if (tracks != null) hints.rows = tracks;
        break;
      }
      case "column": {
        const ref = normalizeTrackRef(stmt.value);
        if (ref != null) hints.column = ref;
        break;
      }
      case "row": {
        const ref = normalizeTrackRef(stmt.value);
        if (ref != null) hints.row = ref;
        break;
      }
      case "span": {
        const n = normalizePositiveInt(stmt.value);
        if (n != null) hints.span = n;
        break;
      }
      case "colSpan": {
        const n = normalizePositiveInt(stmt.value);
        if (n != null) hints.colSpan = n;
        break;
      }
      case "rowSpan": {
        const n = normalizePositiveInt(stmt.value);
        if (n != null) hints.rowSpan = n;
        break;
      }
      default:
        break;
    }
  }
  return hints;
}

function removedPresentationDiagnostics(
  props: Record<string, unknown>,
  range: SourceRange,
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const key of REMOVED_PRESENTATION_PROPS) {
    if (!(key in props)) continue;
    out.push({
      severity: "warning",
      code: "FM210",
      message: `presentation.${key} was removed — SVG is chromeless by default; set title, legend, padding, groupAccent, etc. explicitly`,
      range,
      hint:
        key === "preset"
          ? "Presets (document/slide/print/embed) no longer exist."
          : `Drop ${key}; backgrounds, grids, and frames are not part of the SVG embed model.`,
    });
  }
  return out;
}

function extractHints(diagram: DiagramAst): {
  layoutHints: LayoutOptions;
  routingHints: RoutingOptions;
  renderHints: RenderOptions;
  diagnostics: Diagnostic[];
} {
  const layoutHints: LayoutOptions = {};
  const routingHints: RoutingOptions = {};
  const renderHints: RenderOptions = {};
  const diagnostics: Diagnostic[] = [];
  let presentationLayers: PresentationOptions[] = [];

  for (const stmt of diagram.statements) {
    if (stmt.type === "Directive") {
      if (stmt.name === "direction" && stmt.value)
        layoutHints.direction = normalizeDirection(String(stmt.value));
      if (stmt.name === "density" && stmt.value) {
        if (isRemovedDensityAlias(stmt.value)) {
          diagnostics.push({
            severity: "error",
            code: "FM112",
            message: `density "${String(stmt.value)}" is not supported`,
            range: stmt.range,
            hint: "Use density compact, normal, or spacious",
          });
        }
        const density = normalizeDensity(stmt.value);
        if (density) layoutHints.density = density;
      }
    }
    if (stmt.type === "LayoutBlock") {
      if (stmt.properties.direction)
        layoutHints.direction = normalizeDirection(String(stmt.properties.direction));
      if (stmt.properties.density) {
        if (isRemovedDensityAlias(stmt.properties.density)) {
          diagnostics.push({
            severity: "error",
            code: "FM112",
            message: `density "${String(stmt.properties.density)}" is not supported`,
            range: stmt.range,
            hint: "Use density compact, normal, or spacious",
          });
        }
        const density = normalizeDensity(stmt.properties.density);
        if (density) layoutHints.density = density;
      }
      if (stmt.properties.spacingScale != null) {
        const spacingScale = optionalNumber(stmt.properties.spacingScale);
        if (spacingScale != null) layoutHints.spacingScale = spacingScale;
      }
      const groupLayout = normalizeGroupLayout(stmt.properties.groupLayout);
      if (groupLayout) layoutHints.groupLayout = groupLayout;
      const nodePlacement = normalizeNodePlacement(stmt.properties.nodePlacement);
      if (nodePlacement) layoutHints.nodePlacement = nodePlacement;
      const considerModelOrder = normalizeBool(stmt.properties.considerModelOrder);
      if (considerModelOrder != null) layoutHints.considerModelOrder = considerModelOrder;
      const groupGap = optionalNumber(stmt.properties.groupGap);
      if (groupGap != null) layoutHints.groupGap = groupGap;
      const edgeNodeSpacing = optionalNumber(stmt.properties.edgeNodeSpacing);
      if (edgeNodeSpacing != null) layoutHints.edgeNodeSpacing = edgeNodeSpacing;
      const edgeEdgeSpacing = optionalNumber(stmt.properties.edgeEdgeSpacing);
      if (edgeEdgeSpacing != null) layoutHints.edgeEdgeSpacing = edgeEdgeSpacing;
      const edgeLabelSpacing = optionalNumber(stmt.properties.edgeLabelSpacing);
      if (edgeLabelSpacing != null) layoutHints.edgeLabelSpacing = edgeLabelSpacing;
      const arrange = normalizeRegionArrange(stmt.properties.arrange);
      if (arrange) layoutHints.arrange = arrange;
      const align = normalizeRegionAlign(stmt.properties.align);
      if (align) layoutHints.align = align;
      const gap = normalizeGap(stmt.properties.gap);
      if (gap != null) layoutHints.gap = gap;
      const columns = normalizeTrackSpec(stmt.properties.columns);
      if (columns != null) layoutHints.columns = columns;
      const rows = normalizeTrackSpec(stmt.properties.rows);
      if (rows != null) layoutHints.rows = rows;
      // Convenience: edgeGap tight|normal|wide → edge/edge-node spacing only
      // (does not crush layer gap — reverse edges still need arrow room).
      const edgeGap = stmt.properties.edgeGap != null ? String(stmt.properties.edgeGap) : "";
      if (edgeGap === "tight" || edgeGap === "normal" || edgeGap === "wide") {
        const presets = {
          // Keep a stub+arrow budget even on "tight" (layout floors at 28).
          tight: { edgeNodeSpacing: 28, edgeEdgeSpacing: 14, edgeLabelSpacing: 10 },
          normal: { edgeNodeSpacing: 36, edgeEdgeSpacing: 28, edgeLabelSpacing: 16 },
          wide: { edgeNodeSpacing: 72, edgeEdgeSpacing: 56, edgeLabelSpacing: 28 },
        } as const;
        const p = presets[edgeGap];
        if (layoutHints.edgeNodeSpacing == null) layoutHints.edgeNodeSpacing = p.edgeNodeSpacing;
        if (layoutHints.edgeEdgeSpacing == null) layoutHints.edgeEdgeSpacing = p.edgeEdgeSpacing;
        if (layoutHints.edgeLabelSpacing == null) layoutHints.edgeLabelSpacing = p.edgeLabelSpacing;
      }
    }
    if (stmt.type === "EdgePolicyBlock") {
      if (stmt.properties.route)
        routingHints.route = String(stmt.properties.route) as RoutingOptions["route"];
      if (stmt.properties.crossings) {
        const crossings = normalizeCrossings(stmt.properties.crossings);
        if (crossings) routingHints.crossings = crossings;
      }
      if (stmt.properties.cornerRadius != null)
        routingHints.cornerRadius = Number(stmt.properties.cornerRadius);
      if (stmt.properties.parallel)
        routingHints.parallel = String(stmt.properties.parallel) as RoutingOptions["parallel"];
      if (stmt.properties.arrowheads != null)
        routingHints.arrowheads = stmt.properties.arrowheads !== false;
    }
    if (stmt.type === "PresentationBlock") {
      diagnostics.push(...removedPresentationDiagnostics(stmt.properties, stmt.range));
      presentationLayers.push(presentationFromProperties(stmt.properties));
    }
    if (stmt.type === "RenderBlock") {
      if (stmt.properties.theme)
        renderHints.theme = String(stmt.properties.theme) as RenderOptions["theme"];
      if (stmt.properties.shadows != null) renderHints.shadows = stmt.properties.shadows !== false;
      if (stmt.properties.roundedCorners != null)
        renderHints.roundedCorners = stmt.properties.roundedCorners !== false;
      const presentationPreset = stmt.properties.presentation;
      if (typeof presentationPreset === "string") {
        diagnostics.push({
          severity: "warning",
          code: "FM210",
          message: `render.presentation: "${presentationPreset}" presets were removed — SVG is chromeless by default`,
          range: stmt.range,
          hint: "Use presentation { title, padding, groupAccent, … } for opt-in chrome.",
        });
      } else {
        diagnostics.push(...removedPresentationDiagnostics(stmt.properties, stmt.range));
        presentationLayers.push(presentationFromProperties(stmt.properties));
      }
    }
  }

  const mergedPresentation = mergePresentationOptions(...presentationLayers);
  if (mergedPresentation) renderHints.presentation = mergedPresentation;

  return { layoutHints, routingHints, renderHints, diagnostics };
}

export function compile(ast: KDiagramAst, diagramIndex = 0): CompileResult {
  const top = ast.body[diagramIndex];
  if (top?.type === "Sequence") {
    return compileSequence(ast, diagramIndex);
  }

  const diagnostics: Diagnostic[] = [...ast.diagnostics];
  const diagram = top;
  if (!diagram || diagram.type !== "Diagram") {
    diagnostics.push({
      severity: "error",
      code: "FM100",
      message: "No diagram found in document",
      range: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
    });
    return {
      graph: {
        id: "empty",
        nodes: [],
        edges: [],
        groups: [],
        styles: [],
        animations: [],
        diagnostics,
      },
      layoutHints: {},
      routingHints: {},
      renderHints: {},
      diagnostics,
    };
  }

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const groups: GraphGroup[] = [];
  const styles: StyleDefinition[] = [];

  const pendingGroupMembers: Array<{
    nodeId: string;
    groupId: string;
    range: import("../types/geometry.ts").SourceRange;
  }> = [];

  collectStatements(diagram.statements, {
    nodes,
    edges,
    groups,
    styles,
    diagnostics,
    groupStack: [],
    edgeCounter: 0,
    pendingGroupMembers,
  });

  for (const pending of pendingGroupMembers) {
    const node = nodes.get(pending.nodeId);
    const group = groups.find((g) => g.id === pending.groupId);
    if (node && group) {
      node.groupId = pending.groupId;
      if (!group.nodeIds.includes(pending.nodeId)) group.nodeIds.push(pending.nodeId);
      if (!group.members?.some((m) => m.kind === "node" && m.id === pending.nodeId)) {
        group.members?.push({ kind: "node", id: pending.nodeId });
      }
    } else {
      diagnostics.push({
        severity: "warning",
        code: "FM106",
        message: `Group membership references unknown node "${pending.nodeId}"`,
        range: pending.range,
      });
    }
  }

  for (const edge of edges) {
    if (!nodes.has(edge.from)) {
      diagnostics.push({
        severity: "error",
        code: "FM103",
        message: `Edge references unknown node "${edge.from}"`,
        range: edge.sourceRange ?? diagram.range,
      });
    }
    if (!nodes.has(edge.to)) {
      diagnostics.push({
        severity: "error",
        code: "FM104",
        message: `Edge references unknown node "${edge.to}"`,
        range: edge.sourceRange ?? diagram.range,
      });
    }
  }

  for (const group of groups) {
    if (group.arrange !== "surround") continue;
    const childGroups = group.childGroupIds.length;
    if (childGroups === 0) {
      diagnostics.push({
        severity: "error",
        code: "FM114",
        message: `Group "${group.id}" uses arrange: surround but has no nested hub group`,
        range: diagram.range,
        hint: "Nest exactly one group as the center; place satellite nodes as siblings of that group.",
      });
    } else if (childGroups > 1) {
      diagnostics.push({
        severity: "error",
        code: "FM114",
        message: `Group "${group.id}" uses arrange: surround with ${childGroups} nested groups`,
        range: diagram.range,
        hint: "Surround allows exactly one nested hub group per parent; nest further surround layers inside that hub.",
      });
    }
  }

  // Materialize FK column refs (`-> customers.id`) into column-anchored relationships.
  let edgeCounter = edges.length;
  for (const node of nodes.values()) {
    if (!node.columns) continue;
    for (const col of node.columns) {
      const ref = col.references;
      if (!ref) continue;
      const target = nodes.get(ref.table);
      if (!target) {
        diagnostics.push({
          severity: "error",
          code: "FM107",
          message: `FK "${node.id}.${col.name}" references unknown table "${ref.table}"`,
          range: node.sourceRange ?? diagram.range,
        });
        continue;
      }
      if (findColumnIndex(target.columns, ref.column) < 0 && target.columns?.length) {
        diagnostics.push({
          severity: "warning",
          code: "FM108",
          message: `FK "${node.id}.${col.name}" references unknown column "${ref.table}.${ref.column}"`,
          range: node.sourceRange ?? diagram.range,
        });
      }

      const card = fkCardinality(col.notNull);
      const existing = edges.find(
        (e) =>
          e.from === ref.table &&
          e.to === node.id &&
          (e.fromColumn == null || e.fromColumn === ref.column) &&
          (e.toColumn == null || e.toColumn === col.name),
      );
      if (existing) {
        existing.fromColumn ??= ref.column;
        existing.toColumn ??= col.name;
        existing.cardinality ??= card;
        // Column-anchored FKs default to non-identifying unless author set it.
        if (existing.identifying == null) existing.identifying = false;
        continue;
      }

      // Reverse-authored edge (FK → PK): enrich rather than duplicate.
      const reverse = edges.find(
        (e) =>
          e.from === node.id &&
          e.to === ref.table &&
          (e.fromColumn == null || e.fromColumn === col.name) &&
          (e.toColumn == null || e.toColumn === ref.column),
      );
      if (reverse) {
        reverse.fromColumn ??= col.name;
        reverse.toColumn ??= ref.column;
        // Flip IE ends: authored child→parent, card is parent→child.
        reverse.cardinality ??= { from: card.to, to: card.from };
        if (reverse.identifying == null) reverse.identifying = false;
        continue;
      }

      edgeCounter++;
      edges.push({
        id: `e${edgeCounter}`,
        from: ref.table,
        to: node.id,
        fromColumn: ref.column,
        toColumn: col.name,
        kind: "sync",
        styleRefs: [],
        cardinality: card,
        identifying: false,
        sourceRange: node.sourceRange,
      });
    }
  }

  for (const edge of edges) {
    const fromNode = nodes.get(edge.from);
    const toNode = nodes.get(edge.to);
    if (edge.fromColumn && fromNode) {
      if (findColumnIndex(fromNode.columns, edge.fromColumn) < 0) {
        diagnostics.push({
          severity: "warning",
          code: "FM109",
          message: `Edge column "${edge.from}.${edge.fromColumn}" not found on table`,
          range: edge.sourceRange ?? diagram.range,
        });
      }
    }
    if (edge.toColumn && toNode) {
      if (findColumnIndex(toNode.columns, edge.toColumn) < 0) {
        diagnostics.push({
          severity: "warning",
          code: "FM110",
          message: `Edge column "${edge.to}.${edge.toColumn}" not found on table`,
          range: edge.sourceRange ?? diagram.range,
        });
      }
    }

    // Refine default column-edge cardinality from FK nullability (IE: optional parent when FK nullable).
    if (edge.fromColumn && edge.toColumn && !parseCardinality(edge.label)) {
      const toFk = toNode?.columns?.find((c) => c.name === edge.toColumn && c.keys.includes("fk"));
      const fromFk = fromNode?.columns?.find(
        (c) => c.name === edge.fromColumn && c.keys.includes("fk"),
      );
      const refined = toFk
        ? fkCardinality(toFk.notNull)
        : fromFk
          ? (() => {
              const c = fkCardinality(fromFk.notNull);
              return { from: c.to, to: c.from };
            })()
          : undefined;
      if (refined) {
        const looksLikeGenericDefault =
          edge.cardinality?.from === "one" && edge.cardinality?.to === "zeroOrMany";
        if (!edge.cardinality || looksLikeGenericDefault) {
          edge.cardinality = refined;
        }
      }
    }

    // Only column-anchored FK relationships default to non-identifying (dashed).
    if (
      edge.identifying == null &&
      (edge.fromColumn || edge.toColumn) &&
      fromNode?.shape === "table" &&
      toNode?.shape === "table"
    ) {
      edge.identifying = false;
    }
  }

  if (diagram.diagramKind === "state") {
    const initialNodes = [...nodes.values()].filter((node) => node.kind === "initial");
    const finalNodes = [...nodes.values()].filter((node) => node.kind === "final");
    if (initialNodes.length !== 1) {
      diagnostics.push({
        severity: initialNodes.length === 0 ? "warning" : "error",
        code: "FM150",
        message:
          initialNodes.length === 0
            ? "State diagram has no initial pseudostate"
            : "State diagram must have exactly one initial pseudostate",
        range: initialNodes[1]?.sourceRange ?? diagram.range,
        hint: 'Declare one symbolic entry node, for example `entry: initial "Start"`.',
      });
    }
    if (finalNodes.length === 0) {
      diagnostics.push({
        severity: "warning",
        code: "FM151",
        message: "State diagram has no final state",
        range: diagram.range,
        hint: 'Declare at least one terminal node, for example `done: final "Completed"`.',
      });
    }
    for (const node of initialNodes) {
      const incoming = edges.filter((edge) => edge.to === node.id);
      const outgoing = edges.filter((edge) => edge.from === node.id);
      if (incoming.length > 0) {
        diagnostics.push({
          severity: "error",
          code: "FM152",
          message: `Initial pseudostate "${node.id}" cannot have incoming transitions`,
          range: incoming[0]?.sourceRange ?? node.sourceRange ?? diagram.range,
        });
      }
      if (outgoing.length !== 1) {
        diagnostics.push({
          severity: "warning",
          code: "FM153",
          message: `Initial pseudostate "${node.id}" should have exactly one outgoing transition`,
          range: node.sourceRange ?? diagram.range,
        });
      }
    }
    for (const node of finalNodes) {
      const outgoing = edges.find((edge) => edge.from === node.id);
      if (outgoing) {
        diagnostics.push({
          severity: "error",
          code: "FM154",
          message: `Final state "${node.id}" cannot have outgoing transitions`,
          range: outgoing.sourceRange ?? node.sourceRange ?? diagram.range,
        });
      }
    }
  }

  const graph: GraphModel = {
    id: diagram.name ? diagram.name.toLowerCase().replace(/\s+/g, "-") : "diagram",
    title: diagram.name,
    diagramKind: diagram.diagramKind,
    nodes: [...nodes.values()],
    edges,
    groups,
    styles,
    animations: compileAnimationBlocks(
      collectAnimationBlocks(diagram.statements),
      nodes,
      diagnostics,
    ),
    diagnostics,
  };

  const hints = extractHints(diagram);
  diagnostics.push(...hints.diagnostics);
  const { diagnostics: _hintDiags, ...hintFields } = hints;
  if (diagram.diagramKind === "state") {
    hintFields.layoutHints = {
      ...hintFields.layoutHints,
      direction: hintFields.layoutHints.direction ?? "TD",
    };
  }
  return { graph, ...hintFields, diagnostics };
}

function collectAnimationBlocks(statements: StatementAst[]): AnimationBlockAst[] {
  const blocks: AnimationBlockAst[] = [];
  for (const stmt of statements) {
    if (stmt.type === "AnimationBlock") blocks.push(stmt);
    if (stmt.type === "Group") blocks.push(...collectAnimationBlocks(stmt.statements));
  }
  return blocks;
}
