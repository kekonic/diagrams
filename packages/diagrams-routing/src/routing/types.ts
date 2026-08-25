import type { Diagnostic, Point } from "@kekonic/diagrams-core";
import type { CubicBezier } from "./path-style.ts";

export type RoutedEdge = {
  edgeId: string;
  points: Point[];
  segments: Array<{ from: Point; to: Point }>;
  /** Organic cubics for metro / rounded / bezier. Crossing treatment may flatten these. */
  cubics?: CubicBezier[];
};

/** Post-ELK edge geometry after label placement and endpoint trim. */
export type RoutingResult = {
  edges: RoutedEdge[];
  algorithmVersion: string;
  routeMs: number;
  diagnostics: Diagnostic[];
};
