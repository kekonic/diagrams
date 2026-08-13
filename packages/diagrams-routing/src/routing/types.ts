import type { Diagnostic, Point } from "@kekonic/diagrams-core";

export type RoutedEdge = {
  edgeId: string;
  points: Point[];
  segments: Array<{ from: Point; to: Point }>;
};

/** Post-ELK edge geometry after label placement and endpoint trim. */
export type RoutingResult = {
  edges: RoutedEdge[];
  algorithmVersion: string;
  routeMs: number;
  diagnostics: Diagnostic[];
};
