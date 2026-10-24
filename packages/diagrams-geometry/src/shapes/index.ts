import { rectangleGeometry, roundedRectangleGeometry, pillGeometry } from "./rectangle.ts";
import { diamondGeometry, diamondPointsString, diamondPolygon } from "./diamond.ts";
import { hexagonGeometry, hexagonInset, hexagonPointsString, hexagonPolygon } from "./hexagon.ts";
import {
  cylinderGeometry,
  cylinderPaths,
  cylinderRadii,
  cylinderSilhouettePolygon,
} from "./cylinder.ts";
import { queueGeometry, queuePaths, queueRadii, queueSilhouettePolygon } from "./queue.ts";
import {
  streamCornerRadius,
  streamGeometry,
  streamPartitionPaths,
  streamPartitionYs,
  streamShellPath,
} from "./stream.ts";
import { circleGeometry, ellipseGeometry } from "./ellipse.ts";
import {
  ballGeometry,
  ballGlyphBox,
  INTERFACE_GLYPH_LABEL_GAP,
  INTERFACE_GLYPH_SIZE,
  interfaceGlyphSize,
  socketArcPath,
  socketGeometry,
  socketGlyphBox,
} from "./interface-glyph.ts";
import { parallelogramGeometry, trapezoidGeometry, triangleGeometry } from "./polygons.ts";
import { documentGeometry, foldedDocumentGeometry } from "./document.ts";
import { cloudGeometry } from "./cloud.ts";
import {
  boundaryGeometry,
  compartmentedRectangleGeometry,
  personGeometry,
  personHeadStackHeight,
  personPaths,
  personPortAnchors,
  personSilhouettePolygon,
} from "./person.ts";

export {
  rectangleGeometry,
  roundedRectangleGeometry,
  pillGeometry,
  diamondGeometry,
  diamondPointsString,
  diamondPolygon,
  hexagonGeometry,
  hexagonInset,
  hexagonPointsString,
  hexagonPolygon,
  queueGeometry,
  queuePaths,
  queueRadii,
  queueSilhouettePolygon,
  streamCornerRadius,
  streamGeometry,
  streamPartitionPaths,
  streamPartitionYs,
  streamShellPath,
  cylinderGeometry,
  cylinderPaths,
  cylinderRadii,
  cylinderSilhouettePolygon,
  circleGeometry,
  ellipseGeometry,
  ballGeometry,
  ballGlyphBox,
  socketGeometry,
  socketGlyphBox,
  socketArcPath,
  interfaceGlyphSize,
  INTERFACE_GLYPH_SIZE,
  INTERFACE_GLYPH_LABEL_GAP,
  parallelogramGeometry,
  trapezoidGeometry,
  triangleGeometry,
  documentGeometry,
  foldedDocumentGeometry,
  cloudGeometry,
  personGeometry,
  personHeadStackHeight,
  personPaths,
  personPortAnchors,
  personSilhouettePolygon,
  compartmentedRectangleGeometry,
  boundaryGeometry,
};

/** All built-in geometries keyed by id. */
export const BUILTIN_GEOMETRIES = {
  rectangle: rectangleGeometry,
  rounded: roundedRectangleGeometry,
  pill: pillGeometry,
  diamond: diamondGeometry,
  hexagon: hexagonGeometry,
  queue: queueGeometry,
  stream: streamGeometry,
  cylinder: cylinderGeometry,
  circle: circleGeometry,
  ball: ballGeometry,
  socket: socketGeometry,
  ellipse: ellipseGeometry,
  parallelogram: parallelogramGeometry,
  trapezoid: trapezoidGeometry,
  triangle: triangleGeometry,
  document: documentGeometry,
  "folded-document": foldedDocumentGeometry,
  cloud: cloudGeometry,
  person: personGeometry,
  table: compartmentedRectangleGeometry,
  boundary: boundaryGeometry,
} as const;

export type BuiltinGeometryId = keyof typeof BUILTIN_GEOMETRIES;
