import type { Diagnostic } from "@kekonic/diagrams-core";
import type { GraphModel, LayoutOptions, RoutingOptions } from "@kekonic/diagrams-core";
import type { MeasuredNode } from "@kekonic/diagrams-layout";
import type { LayoutResult } from "@kekonic/diagrams-layout";
import type { RoutingResult } from "@kekonic/diagrams-routing";
import type { DiagramTopology } from "@kekonic/diagrams-layout";
import type { EdgeLabelPlacement } from "@kekonic/diagrams-routing";
import type { TreatedEdge } from "@kekonic/diagrams-routing";

export type MeasuredGraph = {
  graph: GraphModel;
  measured: MeasuredNode[];
  topology: DiagramTopology;
  diagnostics: Diagnostic[];
};

export type LaidOutGraph = MeasuredGraph & {
  layout: LayoutResult;
};

export type RoutedGraph = LaidOutGraph & {
  routing: RoutingResult;
};

export type FinalizedGraph = RoutedGraph & {
  labels: EdgeLabelPlacement[];
  treatedEdges: TreatedEdge[];
};

export type PipelineDefaults = {
  layout: LayoutOptions;
  routing: RoutingOptions;
};
