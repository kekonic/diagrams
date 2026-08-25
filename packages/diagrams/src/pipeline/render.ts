import { compile, type CompileTarget } from "@kekonic/diagrams-core";
import { parse } from "@kekonic/diagrams-core";
import { resolvePresentation } from "@kekonic/diagrams-core";
import {
  measureGraph,
  measurerUsedApproximationFallback,
  layoutAndRouteWithElk,
  ELK_LAYOUT_ALGORITHM,
  ELK_ROUTER_ALGORITHM,
  analyzeDiagramTopology,
} from "@kekonic/diagrams-layout";
import { collectIconIds, preloadIcons } from "@kekonic/diagrams-icons";
import { renderSvg } from "@kekonic/diagrams-render-svg";
import { finalizeElkEdges } from "./finalize-edges.ts";
import type {
  CompileResult,
  Diagnostic,
  GraphModel,
  Direction,
  LayoutOptions,
  ParseResult,
  RenderOptions,
  RenderResult,
  RenderStats,
  RoutingOptions,
} from "@kekonic/diagrams-core";
import { mergeOptions as merge, mergePresentationOptions } from "@kekonic/diagrams-core";
import type { LayoutResult } from "@kekonic/diagrams-layout";
import type { RoutingResult } from "@kekonic/diagrams-routing";
import type { EdgeLabelPlacement } from "@kekonic/diagrams-routing";
import type { TreatedEdge } from "@kekonic/diagrams-routing";
import type { MeasuredGraph, LaidOutGraph, RoutedGraph, FinalizedGraph } from "./artifacts.ts";
import { analyzeDiagramQuality } from "../quality.ts";

export type PipelineRenderResult = Omit<RenderResult, "layout" | "routing"> & {
  layout?: LayoutResult;
  routing?: RoutingResult;
  /** KDiagram-placed edge label boxes (post-ELK). */
  labels?: EdgeLabelPlacement[];
};

const DEFAULT_LAYOUT: LayoutOptions = {
  direction: "LR",
  density: "normal",
  spacingScale: 1.1,
  algorithmVersion: "elk-layered-v1",
  groupLayout: "compound",
  nodePlacement: "balanced",
};

const DEFAULT_ROUTING: RoutingOptions = {
  route: "metro",
  crossings: "gaps",
  arrowheads: true,
};

const DEFAULT_RENDER: RenderOptions = {
  theme: "dark",
  shadows: false,
  roundedCorners: false,
};

export function parseSource(source: string): ParseResult {
  const ast = parse(source);
  return { ast, diagnostics: ast.diagnostics };
}

export function compileSource(source: string, target: CompileTarget = 0): CompileResult {
  const { ast } = parseSource(source);
  return compile(ast, target);
}

export type PipelineCompileOptions = {
  diagramIndex?: number;
  view?: string;
};

function resolveCompileTarget(options: PipelineCompileOptions = {}): CompileTarget {
  if (options.view != null) {
    return { diagramIndex: options.diagramIndex ?? 0, view: options.view };
  }
  if (options.diagramIndex != null) return options.diagramIndex;
  return 0;
}

export function measureFromGraph(graph: GraphModel, direction: Direction = "LR"): MeasuredGraph {
  const measured = measureGraph(graph);
  const topology = analyzeDiagramTopology(graph, direction);
  return { graph, measured: measured.nodes, topology, diagnostics: [] };
}

export async function layoutFromGraph(
  graph: GraphModel,
  layoutOpts: LayoutOptions = {},
): Promise<LayoutResult> {
  const opts = merge(DEFAULT_LAYOUT, layoutOpts);
  const measured = measureGraph(graph);
  const result = await layoutAndRouteWithElk(graph, measured.nodes, opts);
  return result.layout;
}

export async function layoutMeasuredGraph(
  measuredGraph: MeasuredGraph,
  layoutOpts: LayoutOptions = {},
): Promise<LaidOutGraph> {
  const opts = merge(DEFAULT_LAYOUT, layoutOpts);
  const result = await layoutAndRouteWithElk(measuredGraph.graph, measuredGraph.measured, opts);
  return { ...measuredGraph, layout: result.layout };
}

export type RouteFromLayoutResult = {
  labels: EdgeLabelPlacement[];
  treatedEdges: TreatedEdge[];
  routing: RoutingResult;
};

/**
 * Finalize labels + endpoint trim from ELK edge paths on `layout`.
 * Does not re-run layout — ELK already owned routing in `layoutFromGraph` / `layoutMeasuredGraph`.
 */
export function routeFromLayout(
  graph: GraphModel,
  layout: LayoutResult,
  routingOpts: RoutingOptions = {},
): RouteFromLayoutResult {
  const opts = merge(DEFAULT_ROUTING, routingOpts);
  const t0 = performance.now();
  const finalized = finalizeElkEdges({
    graph,
    layout,
    edgePaths: layout.edgePaths,
    routingOpts: opts,
  });
  return {
    labels: finalized.labels,
    treatedEdges: finalized.treatedEdges,
    routing: {
      edges: finalized.routingEdges,
      algorithmVersion: ELK_ROUTER_ALGORITHM,
      routeMs: performance.now() - t0,
      diagnostics: [],
    },
  };
}

export function routeLaidOutGraph(
  laidOut: LaidOutGraph,
  routingOpts: RoutingOptions = {},
): RoutedGraph {
  const routed = routeFromLayout(laidOut.graph, laidOut.layout, routingOpts);
  return {
    ...laidOut,
    routing: routed.routing,
  };
}

export function finalizeRoutedGraph(
  routed: RoutedGraph,
  routingOpts: RoutingOptions = {},
): FinalizedGraph {
  const opts = merge(DEFAULT_ROUTING, routingOpts);
  const finalized = finalizeElkEdges({
    graph: routed.graph,
    layout: routed.layout,
    edgePaths: routed.layout.edgePaths,
    routingOpts: opts,
  });
  return {
    ...routed,
    routing: {
      ...routed.routing,
      edges: finalized.routingEdges,
    },
    labels: finalized.labels,
    treatedEdges: finalized.treatedEdges,
  };
}

export async function renderPipeline(
  source: string,
  options: RenderOptions & {
    layout?: LayoutOptions;
    edges?: RoutingOptions;
  } & PipelineCompileOptions = {},
): Promise<PipelineRenderResult> {
  const t0 = performance.now();
  const diagnostics: Diagnostic[] = [];

  const tParse = performance.now();
  const { ast, diagnostics: parseDiags } = parseSource(source);
  diagnostics.push(...parseDiags);
  const parseMs = performance.now() - tParse;

  const tCompile = performance.now();
  const compiled = compile(ast, resolveCompileTarget(options));
  diagnostics.push(...compiled.diagnostics);
  const graph = compiled.graph;
  const compileMs = performance.now() - tCompile;

  const hasErrors = diagnostics.some((d) => d.severity === "error");
  if (hasErrors) {
    return emptyResult(diagnostics, {
      parseMs,
      compileMs,
      measureMs: 0,
      layoutMs: 0,
      routeMs: 0,
      renderMs: 0,
      totalMs: performance.now() - t0,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      layoutAlgorithm: ELK_LAYOUT_ALGORITHM,
      routerAlgorithm: ELK_ROUTER_ALGORITHM,
    });
  }

  const layoutOpts = merge(DEFAULT_LAYOUT, compiled.layoutHints, options.layout);
  const routingOpts = merge(DEFAULT_ROUTING, compiled.routingHints, options.edges);
  const renderOpts = merge(DEFAULT_RENDER, compiled.renderHints, options);
  renderOpts.presentation = mergePresentationOptions(
    compiled.renderHints.presentation,
    options.presentation,
  );
  const presentation = resolvePresentation(renderOpts.presentation, graph.title);

  // Resolve icon viewBoxes before measure so card columns use real aspect widths.
  await preloadIcons(collectIconIds([...graph.nodes, ...graph.edges, ...graph.groups]));

  const tMeasure = performance.now();
  const measured = measureGraph(graph, undefined, {
    reserveKindSubtitles: presentation.showKindSubtitles,
  });
  const measureMs = performance.now() - tMeasure;
  if (measurerUsedApproximationFallback()) {
    diagnostics.push({
      severity: "warning",
      code: "FM210",
      message: "Text measurement using approximation fallback; bundled font unavailable",
      range: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
      hint: "Install @fontsource/inter for shared CLI/browser metrics",
    });
  }

  const tLayout = performance.now();
  const elk = await layoutAndRouteWithElk(graph, measured.nodes, layoutOpts);
  const layout = elk.layout;
  const layoutMs = performance.now() - tLayout;

  const tRoute = performance.now();
  const finalized = finalizeElkEdges({
    graph,
    layout,
    edgePaths: layout.edgePaths,
    routingOpts,
  });
  diagnostics.push(...analyzeDiagramQuality(graph, layout, finalized.routingEdges).diagnostics);
  const routeMs = performance.now() - tRoute;

  const routing: RoutingResult = {
    edges: finalized.routingEdges,
    algorithmVersion: elk.routerAlgorithm,
    routeMs,
    diagnostics: [],
  };

  const tRender = performance.now();
  const renderInput = {
    graph,
    layout,
    measured: measured.nodes,
    treatedEdges: finalized.treatedEdges,
    labels: finalized.labels,
    options: renderOpts,
    routingOptions: {
      route: routingOpts.route ?? "orthogonal",
      cornerRadius: routingOpts.cornerRadius,
      arrowheads: routingOpts.arrowheads,
    },
  };

  const svg = renderSvg(renderInput);
  const renderMs = performance.now() - tRender;

  const stats: RenderStats = {
    parseMs,
    compileMs,
    measureMs,
    layoutMs,
    routeMs,
    renderMs,
    totalMs: performance.now() - t0,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    layoutAlgorithm: layout.algorithmVersion,
    routerAlgorithm: routing.algorithmVersion,
  };

  return {
    ok: true,
    svg,
    ast,
    graph,
    layout,
    routing,
    labels: finalized.labels,
    diagnostics,
    stats,
  };
}

function emptyResult(diagnostics: Diagnostic[], stats: RenderStats): PipelineRenderResult {
  return { ok: false, diagnostics, stats };
}
