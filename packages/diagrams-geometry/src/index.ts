export type * from "./types.ts";
export {
  CLEAR_SPACE_PRESETS,
  EDGE_LAUNCH_PRESETS,
  MIN_INTERACTION_TARGET,
  DEFAULT_STROKE_WIDTH,
  uniformInsets,
  insets,
  insetRect,
  expandRectInsets,
  unionRects,
  rectFromSize,
  normalizeVector,
  sideNormal,
  sideMidpoint,
} from "./types.ts";

export type { ShapeGeometry, ShapeGeometryBaseOptions } from "./shape-geometry.ts";
export {
  buildNodeBoundsModel,
  defaultVisualBounds,
  defaultLayoutFootprint,
  defaultSidePortPosition,
  distributedSidePort,
  defaultPortNormal,
  projectSidePortOntoOutline,
  projectSidePortOntoPolygon,
} from "./shape-geometry.ts";

export {
  intersectRayPolygon,
  intersectRayEllipse,
  intersectRayRect,
  rectPolygon,
  pointInPolygon,
  pointInEllipse,
  polygonToPath,
  closedCatmullRomToPath,
  centeredContentRect,
  strokeOutset,
} from "./math.ts";

export {
  registerShape,
  unregisterShape,
  getShapeDefinition,
  getShapeGeometry,
  resolveShapeGeometry,
  listRegisteredShapeIds,
  normalizeShapeId,
  registerNodeType,
  unregisterNodeType,
  getNodeTypeDefinition,
  resolveNodeTypeGeometry,
  listRegisteredNodeTypeIds,
  type ShapeDefinition,
  type NodeTypeDefinition,
  type RenderDecoration,
} from "./registry.ts";

export { geometrySizeForContent, relativeContentBox, type ContentSize } from "./measure.ts";

export { attachPointOnPerimeter, type PerimeterAttachInput } from "./attach.ts";

export * from "./shapes/index.ts";
