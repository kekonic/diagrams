/**
 * Post-ELK edge finishing: crossing treatment (gaps/jumps), endpoint insets for
 * markers, and shared types for routed polylines. Orthogonal corridors normally
 * come from ELK; region-arrange may seed fixed stubs via layout's candidate
 * avoider. Silhouette attach (`attachPointOnPerimeter`) is owned by layout via
 * geometry. This package does not search routes.
 */
export type { RoutedEdge, RoutingResult } from "./routing/index.ts";
export { attachPointOnPerimeter, type PerimeterAttachInput } from "./routing/perimeter.ts";
export {
  applyCrossingTreatment,
  detectCrossingPoints,
  trimEdgeEndpoints,
  ARROW_ENDPOINT_INSET,
  CARDINALITY_ENDPOINT_INSET,
  EDGE_ENDPOINT_INSET,
  type TreatedEdge,
  type RenderedEdgeSegment,
} from "./crossings/index.ts";
export type { EdgeLabelPlacement } from "./labels/index.ts";
export { EDGE_LABEL_ICON, EDGE_LABEL_ICON_GAP, EDGE_LABEL_PAD_X } from "./labels/index.ts";
