import type { Diagnostic, SourceRange } from "./geometry.ts";
import type { BranchKind } from "./branch.ts";
import type { EdgeCardinality } from "./cardinality.ts";
import type { TableColumn } from "./table.ts";
import type { ShapeId } from "./shapes.ts";
import type { AnimationDefinition } from "../animation/types.ts";

export type { AnimationTarget, AnimationCue, AnimationDefinition } from "../animation/types.ts";

export type { BranchKind } from "./branch.ts";
export type { Cardinality, EdgeCardinality } from "./cardinality.ts";
export type { TableColumn, TableColumnKey } from "./table.ts";
export type { ShapeId, BuiltinShapeId, GroupChromeShapeId } from "./shapes.ts";
export {
  BUILTIN_SHAPE_IDS,
  GROUP_CHROME_SHAPE_IDS,
  normalizeShapeId,
  normalizeGroupChromeShapeId,
  isKnownShapeId,
  isGroupChromeShapeId,
  listBuiltinShapeIds,
  listGroupChromeShapeIds,
} from "./shapes.ts";

export type EdgeKind = "sync" | "async" | "eventual" | "dependency" | "failure" | "association";
/** Where arrowheads attach after layout (path always runs from → to). */
export type EdgeArrows = "end" | "start" | "both" | "none";
export type GroupKind = "group" | "boundary" | "zone" | "swimlane";
export type Direction = "LR" | "RL" | "TD" | "BT";
/** Whole-diagram spacing preset. Local `gap` / `padding` prefer px numbers. */
export type Density = "compact" | "normal" | "spacious";
export type RouteMode = "straight" | "bezier" | "orthogonal" | "rounded" | "metro";
export type CrossingMode = "none" | "gaps" | "jumps" | "smart";
export type BuiltinThemeMode = "dark" | "light";
/** Built-in themes or names passed to `registerTheme()`. */
export type ThemeMode = BuiltinThemeMode | (string & {});

export type StyleDefinition = {
  name: string;
  /** Defaults to node when omitted (authored `style name { }` / builtins). */
  target?: "node" | "edge" | "fragment";
  properties: Record<string, string>;
};

export type GraphNode = {
  id: string;
  label: string;
  /**
   * True when `label` came from a quoted string literal in source.
   * False when the label was derived from the bare id.
   * Authored labels must render verbatim (aside from XML/SVG escaping).
   */
  labelAuthored?: boolean;
  kind: string;
  /** Geometry id from the shared shape library (normalized at compile). */
  shape?: ShapeId;
  icon?: string;
  /** Paint policy for icons: brand (embedded fills, default) or theme (currentColor). */
  iconPaint?: "theme" | "brand";
  /**
   * Icon-only ink (CSS color). Compiles to `--icon-color` and themes the glyph
   * without changing the node shell stroke/fill.
   */
  iconColor?: string;
  depth?: number;
  minWidth?: number;
  maxWidth?: number;
  /** Presentation scale for measure + label size (1 = default). */
  scale?: number;
  groupId?: string;
  styleRefs: string[];
  unresolvedVars?: Record<string, string>;
  note?: string;
  /**
   * When true, show the built-in kind eyebrow (e.g. "Service") for this node.
   * Prefer authored `subtitle` text when you want a custom line.
   */
  showSubtitle?: boolean;
  /** Optional author-provided subtitle under the title (not the kind name). */
  subtitle?: string;
  /** C4 / architecture technology tag (e.g. "Spring Boot", "[Java]"). */
  technology?: string;
  /** Longer body text under the title (C4 description). */
  description?: string;
  /** ERD columns — when present on a `table` kind, shape becomes an entity card. */
  columns?: TableColumn[];
  /**
   * Cardinal side hint for `arrange: surround` satellites (layout only).
   * West/east map to inbound/outbound by convention.
   */
  side?: "west" | "east" | "north" | "south";
  sourceRange?: SourceRange;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  /**
   * True when `label` came from a quoted string literal in source.
   * Edge labels are only present when authored; keep the flag for render policy.
   */
  labelAuthored?: boolean;
  kind: EdgeKind;
  /**
   * Arrowhead placement on the routed path (`from` → `to`).
   * Reverse DSL ops (`<-`, …) swap endpoints at compile so arrows stay `"end"`.
   * Bidirectional `<->` compiles to `"both"`.
   */
  arrows?: EdgeArrows;
  styleRefs: string[];
  /** Optional icon shown beside the edge label (same id vocabulary as nodes). */
  icon?: string;
  /** Paint policy for edge icons: brand (embedded fills) or theme (currentColor). */
  iconPaint?: "theme" | "brand";
  /** Icon-only ink (CSS color) for the edge label glyph. */
  iconColor?: string;
  priority?: "low" | "normal" | "high";
  /**
   * Prefer the label near the start, middle, or end of the routed path.
   * Auto placement still avoids nodes/crossings; this biases the scorer.
   */
  labelPosition?: "start" | "middle" | "end";
  /** Yes/no/neutral branch cue — explicit DSL or compiled from label. */
  branch?: BranchKind;
  /** ERD relationship multiplicity (crow's-foot markers). */
  cardinality?: EdgeCardinality;
  /** Source column name for ERD column-anchored edges. */
  fromColumn?: string;
  /** Target column name for ERD column-anchored edges. */
  toColumn?: string;
  /**
   * Identifying relationship (solid) vs non-identifying (dashed).
   * Inferred when every FK column is part of the child's primary key;
   * otherwise column-anchored FKs default to non-identifying.
   * Plain table edges without column anchors stay solid unless set explicitly.
   */
  identifying?: boolean;
  /** Sequence message order (0-based) when diagramKind is sequence. */
  sequenceOrder?: number;
  /** Sequence message kind when diagramKind is sequence. */
  sequenceKind?: import("./sequence.ts").SequenceMessageKind;
  sourceRange?: SourceRange;
};

export type RegionArrange = "stack" | "row" | "grid" | "surround";
export type RegionAlign = "stretch" | "start" | "center" | "end";
export type CellArrange = "flow" | "pack" | "stack";
/** Track spec: count, or named tracks for column/row assignment. */
export type TrackSpec = number | string[];

/** Declaration-order member of a group (node or nested group/zone). */
export type GroupMemberRef = { kind: "node"; id: string } | { kind: "group"; id: string };

export type GraphGroup = {
  id: string;
  label: string;
  /**
   * True when `label` came from a quoted string literal in source.
   * False when the label was derived from the bare group id.
   */
  labelAuthored?: boolean;
  kind: GroupKind;
  parentId?: string;
  nodeIds: string[];
  childGroupIds: string[];
  /**
   * Source order of direct members (nodes + child groups).
   * Used by region arrange so interleaved nodes stay on the track.
   */
  members?: GroupMemberRef[];
  styleRefs: string[];
  paddingHint?: string;
  /**
   * When false, skip border/fill/label (layout-only plane).
   * Default true — dashed group chrome.
   */
  chrome?: boolean;
  /**
   * Group chrome silhouette (`rectangle` default).
   * Allowlist: rectangle, rounded, hexagon, circle, ellipse.
   */
  shape?: ShapeId;
  /** Optional glyph beside the group label (same id vocabulary as nodes). */
  icon?: string;
  /** Paint policy for group icons: brand (default for logos) or theme. */
  iconPaint?: "theme" | "brand";
  /** Tint the group glyph without changing the group rim. */
  iconColor?: string;
  /**
   * How this group places its child groups/zones.
   * `stack` / `row` / `grid` = region tracks; `surround` = hub group + node ring;
   * omit = ELK ownership.
   */
  arrange?: RegionArrange;
  /** Cross-axis alignment of child regions (default stretch). */
  align?: RegionAlign;
  /** Gap between child regions (`compact` | `normal` | `spacious` or px). */
  gap?: string | number;
  /** Grid column tracks (count or names). */
  columns?: TrackSpec;
  /** Grid row tracks (count or names). */
  rows?: TrackSpec;
  /** This region's column (1-based index or track name). */
  column?: number | string;
  /** This region's row (1-based index or track name). */
  row?: number | string;
  /** Span along the main axis (stack/row) or shorthand for colSpan. */
  span?: number;
  colSpan?: number;
  rowSpan?: number;
  /** How nodes inside this region are laid out (default flow = ELK). */
  cellArrange?: CellArrange;
};

export type GraphModel = {
  id: string;
  title?: string;
  /** Flow (ELK) vs sequence (time-axis). Default `"flow"` when omitted. */
  diagramKind?: import("./sequence.ts").DiagramKind;
  /** Present when `diagramKind === "sequence"`. */
  sequence?: import("./sequence.ts").SequenceIR;
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  styles: StyleDefinition[];
  /** Authored `animation` blocks compiled onto the graph (auto is inferred separately). */
  animations?: AnimationDefinition[];
  diagnostics: Diagnostic[];
};

export type LayoutOptions = {
  direction?: Direction;
  density?: Density;
  spacingScale?: number;
  algorithmVersion?: "elk-layered-v1";
  groupGap?: number;
  /**
   * Nested group handling for ELK.
   * - `compound` / `auto` → INCLUDE_CHILDREN (default)
   * - `flat` → SEPARATE_CHILDREN
   * - `swimlane` → INCLUDE_CHILDREN (DSL group kind still distinct)
   */
  groupLayout?: "auto" | "flat" | "compound" | "swimlane";
  /**
   * How layered layout places nodes along each rank.
   * - `straight` — prefer aligned/straight edges (ELK Brandes–Köpf)
   * - `balanced` — more even packing (ELK network simplex; default)
   * - `basic` — fastest / simplest placement (often cleaner for ERDs)
   *
   * The compiler also accepts common short aliases (`brandes`, `network`, `simple`)
   * and ELK strategy spellings (`BRANDES_KOEPF`, …) and maps them to these values.
   */
  nodePlacement?: "straight" | "balanced" | "basic";
  /** Prefer source order when ranking/ordering. */
  considerModelOrder?: boolean;
  /** Edge–node clearance override (defaults from density). */
  edgeNodeSpacing?: number;
  /** Parallel-edge clearance override. */
  edgeEdgeSpacing?: number;
  /** Clearance between edge labels and other edges/nodes. */
  edgeLabelSpacing?: number;
  /**
   * Arrange ungrouped nodes and top-level groups/zones into tracks (stack / row / grid).
   * Per-group `arrange` wins when set on a parent.
   */
  arrange?: RegionArrange;
  /** Cross-axis alignment for diagram-level arrange (default stretch). */
  align?: RegionAlign;
  /** Gap between top-level regions when `arrange` is set. */
  gap?: string | number;
  /** Grid columns when diagram `arrange: grid`. */
  columns?: TrackSpec;
  /** Grid rows when diagram `arrange: grid`. */
  rows?: TrackSpec;
};

export type RoutingOptions = {
  /**
   * How edges are drawn after layout. Corridors still come from orthogonal
   * layout; routing then refines the path:
   * - `metro` (default) / `rounded` — organic orthogonal: ease out of the
   *   source port, ease into the target, and curve each avoidance jog
   * - `orthogonal` — the same corridors with sharp corners
   * - `straight` — port-to-port chord when the line of sight is clear; otherwise
   *   a minimal dogleg that follows the existing corridor
   * - `bezier` — obstacle-aware cubic along that corridor (swoopier handles;
   *   same start/end ease and curved avoidance as metro)
   */
  route?: RouteMode;
  crossings?: CrossingMode;
  cornerRadius?: number;
  /**
   * When `route: straight`, `separate` (default) offsets coincident overlapping
   * strokes; `shared` leaves them stacked.
   */
  parallel?: "separate" | "shared";
  arrowheads?: boolean;
  algorithmVersion?: string;
};

import type { PresentationOptions } from "./presentation.ts";

export type RenderOptions = {
  theme?: ThemeMode;
  snapshotTheme?: boolean;
  /** Additive presentation chrome — default chromeless transparent SVG. */
  presentation?: PresentationOptions;
  debug?: DebugOptions;
  /** Opt-in drop shadows / glow. Default off. */
  shadows?: boolean;
  /**
   * Opt-in corner radius on rectangular node shells (rounded/rectangle/pill,
   * ERD tables, groups, edge labels). Default off — sharp corners.
   */
  roundedCorners?: boolean;
};

export type DebugOptions = {
  /** Draw circles at ELK edge attachment points (source + target). */
  showPorts?: boolean;
  showBounds?: boolean;
  showKindLabels?: boolean;
};

export type CompileOptions = Record<string, never>;

/** Wheel zoom policy for live browser hosts (`renderToElement`, `<k-diagram>`). */
export type ZoomOnWheelMode = "modifier" | "always";

export type InteractiveRenderOptions = RenderOptions & {
  layout?: LayoutOptions;
  edges?: RoutingOptions;
  /**
   * How the live host treats wheel input.
   * `"modifier"` (default) zooms only with Ctrl/Cmd + wheel or a trackpad pinch, so
   * unmodified wheel continues page scroll. `"always"` zooms on every wheel event.
   */
  zoomOnWheel?: ZoomOnWheelMode;
};

export type RenderStats = {
  parseMs: number;
  compileMs: number;
  measureMs: number;
  layoutMs: number;
  routeMs: number;
  renderMs: number;
  totalMs: number;
  nodeCount: number;
  edgeCount: number;
  layoutAlgorithm: string;
  routerAlgorithm: string;
};

export type CompileResult = {
  graph: GraphModel;
  layoutHints: LayoutOptions;
  routingHints: RoutingOptions;
  renderHints: RenderOptions;
  diagnostics: Diagnostic[];
};

export type ParseResult = {
  ast: import("../parser/ast.ts").KDiagramAst;
  diagnostics: Diagnostic[];
};

export type RenderResult = {
  ok: boolean;
  svg?: string;
  ast?: import("../parser/ast.ts").KDiagramAst;
  graph?: GraphModel;
  layout?: unknown;
  routing?: unknown;
  diagnostics: Diagnostic[];
  stats: RenderStats;
};

export type AnimationListItem = {
  id: string;
  name: string;
  source: "auto" | "authored";
};

export type AnimationPlayerState = {
  id: string | null;
  playing: boolean;
  timeMs: number;
  durationMs: number;
  loop: boolean;
  /** Playback rate in [0.5, 2]. */
  speed: number;
};

export type AnimationController = {
  list(): AnimationListItem[];
  play(id?: string): void;
  pause(): void;
  stop(): void;
  seek(ms: number): void;
  step(delta: -1 | 1): void;
  setLoop(on: boolean): void;
  /** Clamp playback rate to [0.5, 2]. */
  setSpeed(rate: number): void;
  subscribe(listener: (state: AnimationPlayerState) => void): () => void;
  getState(): AnimationPlayerState;
};

export type RenderController = {
  update(source: string, options?: Partial<InteractiveRenderOptions>): Promise<RenderResult>;
  setTheme(theme: ThemeMode): Promise<RenderResult>;
  /** Resolves after the initial paint (and first fit). */
  ready(): Promise<RenderResult>;
  fit(): void;
  zoomIn(): void;
  zoomOut(): void;
  /** Reset pan/zoom to the fitted natural view (not a model/view switch). */
  resetView(): void;
  /** Diagram animation player (auto path or authored `animation` blocks). */
  animations: AnimationController;
  destroy(): void;
};

export function mergeOptions<T extends Record<string, unknown>>(
  defaults: T,
  ...layers: (Partial<T> | undefined)[]
): T {
  const result = { ...defaults };
  for (const layer of layers) {
    if (!layer) continue;
    for (const [k, v] of Object.entries(layer)) {
      if (v !== undefined) (result as Record<string, unknown>)[k] = v;
    }
  }
  return result;
}
