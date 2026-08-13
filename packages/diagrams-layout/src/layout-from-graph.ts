import type { GraphModel, LayoutOptions } from "@kekonic/diagrams-core";
import { mergeOptions } from "@kekonic/diagrams-core";
import { measureGraph } from "./measure/measure.ts";
import { layoutAndRouteWithElk } from "./layout/elk/layout-with-elk.ts";
import type { LayoutResult } from "./layout/types.ts";

const DEFAULT_LAYOUT: LayoutOptions = {
  direction: "LR",
  density: "normal",
  spacingScale: 1.1,
  algorithmVersion: "elk-layered-v1",
  groupLayout: "compound",
  nodePlacement: "balanced",
};

export async function layoutFromGraph(
  graph: GraphModel,
  layoutOpts: LayoutOptions = {},
): Promise<LayoutResult> {
  const opts = mergeOptions(DEFAULT_LAYOUT, layoutOpts);
  const measured = measureGraph(graph);
  const result = await layoutAndRouteWithElk(graph, measured.nodes, opts);
  return result.layout;
}

export type { LayoutResult };
