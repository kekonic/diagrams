import type { Diagnostic, GraphModel } from "@kekonic/diagrams-core";
import type { LayoutResult } from "@kekonic/diagrams-layout";
import { detectCrossingPoints, type RoutingResult } from "@kekonic/diagrams-routing";

export const DEFAULT_TARGET_ASPECT_RATIO = 16 / 9;
export const QUALITY_CHECKS = [
  "extreme-aspect-ratio",
  "canvas-spanning-edges",
  "excessive-edge-crossings",
  "reverse-layout-flow",
  "edge-label-pressure",
] as const;

export type QualityCheck = (typeof QUALITY_CHECKS)[number];
export type DiagramQualityMetrics = {
  width: number;
  height: number;
  aspectRatio: number;
  targetAspectRatio: number;
  targetAspectRatioDifference: number;
  edgeCrossings: number;
  canvasSpanningEdges: number;
  reverseFlowEdges: number;
  labeledEdges: number;
};

export type DiagramQualityAnalysis = {
  metrics: DiagramQualityMetrics;
  diagnostics: Diagnostic[];
};

const QUALITY_RANGE = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};

/** Measure rendered geometry and return evidence plus actionable, human-readable diagnostics. */
export function analyzeDiagramQuality(
  graph: GraphModel,
  layout: LayoutResult,
  routedEdges: RoutingResult["edges"],
): DiagramQualityAnalysis {
  const aspectRatio = layout.width / Math.max(1, layout.height);
  const crossings = detectCrossingPoints(routedEdges).length;
  const canvasSpanningEdges = layout.edgePaths.filter((path) => {
    if (path.points.length < 2) return false;
    const xs = path.points.map((point) => point.x);
    const ys = path.points.map((point) => point.y);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    let length = 0;
    for (let index = 1; index < path.points.length; index++) {
      const previous = path.points[index - 1]!;
      const current = path.points[index]!;
      length += Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    }
    return (
      Math.max(spanX / Math.max(1, layout.width), spanY / Math.max(1, layout.height)) > 0.72 &&
      length > 0.8 * (layout.width + layout.height)
    );
  }).length;

  const nodeBounds = new Map(layout.nodes.map((node) => [node.nodeId, node.bounds]));
  const horizontal = layout.direction === "LR" || layout.direction === "RL";
  const reverseFlowEdges = graph.edges.filter((edge) => {
    const from = nodeBounds.get(edge.from);
    const to = nodeBounds.get(edge.to);
    if (!from || !to) return false;
    const fromPrimary = horizontal ? from.x + from.width / 2 : from.y + from.height / 2;
    const toPrimary = horizontal ? to.x + to.width / 2 : to.y + to.height / 2;
    const sign = layout.direction === "RL" || layout.direction === "BT" ? -1 : 1;
    return (fromPrimary - toPrimary) * sign > 24;
  }).length;
  const labeledEdges = graph.edges.filter((edge) => edge.label?.trim()).length;
  const metrics: DiagramQualityMetrics = {
    width: layout.width,
    height: layout.height,
    aspectRatio: Number(aspectRatio.toFixed(3)),
    targetAspectRatio: Number(DEFAULT_TARGET_ASPECT_RATIO.toFixed(3)),
    targetAspectRatioDifference: Number(
      Math.abs(aspectRatio - DEFAULT_TARGET_ASPECT_RATIO).toFixed(3),
    ),
    edgeCrossings: crossings,
    canvasSpanningEdges,
    reverseFlowEdges,
    labeledEdges,
  };
  if (graph.nodes.length < 6) return { metrics, diagnostics: [] };

  const diagnostics: Diagnostic[] = [];
  const silhouetteRatio = Math.max(aspectRatio, 1 / Math.max(0.001, aspectRatio));
  if (silhouetteRatio > 3) {
    diagnostics.push({
      severity: "warning",
      code: "extreme-aspect-ratio",
      message: `Diagram canvas is extremely ${layout.width > layout.height ? "wide" : "tall"} (${silhouetteRatio.toFixed(1)}:1)`,
      range: QUALITY_RANGE,
      hint: "Aim near 16:9 by trying another direction, a bounded grid, shorter labels, or multiple views.",
    });
  }
  if (canvasSpanningEdges >= 3) {
    diagnostics.push({
      severity: "warning",
      code: "canvas-spanning-edges",
      message: `${canvasSpanningEdges} edges span most of the canvas`,
      range: QUALITY_RANGE,
      hint: "Separate feedback behavior, reduce cross-region relationships, or use progressive views.",
    });
  }
  if (crossings >= Math.max(5, Math.ceil(graph.edges.length / 3))) {
    diagnostics.push({
      severity: "warning",
      code: "excessive-edge-crossings",
      message: `Diagram contains ${crossings} edge crossings`,
      range: QUALITY_RANGE,
      hint: "Reorder regions, choose a different layout, or split secondary relationships into another view.",
    });
  }
  if (reverseFlowEdges >= Math.max(3, Math.ceil(graph.edges.length * 0.2))) {
    diagnostics.push({
      severity: "warning",
      code: "reverse-layout-flow",
      message: `${reverseFlowEdges} transitions run against the primary layout direction`,
      range: QUALITY_RANGE,
      hint: "Move retry behavior to a focused view or use responsibility lanes and explicit stages.",
    });
  }
  if (graph.edges.length > graph.nodes.length * 1.6 && labeledEdges >= 12) {
    diagnostics.push({
      severity: "warning",
      code: "edge-label-pressure",
      message: "Edge-label pressure is high for the number of nodes",
      range: QUALITY_RANGE,
      hint: "Keep the primary story and move secondary conditions or event catalogs into another view.",
    });
  }
  return { metrics, diagnostics };
}
