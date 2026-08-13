import {
  BUILTIN_KIND_CATALOG,
  normalizeShapeId as coreNormalizeShapeId,
  type NodeCapability,
} from "@kekonic/diagrams-core";
import type { ContentPolicy, Insets, PortStrategy, Size } from "./types.ts";
import type { ShapeGeometry } from "./shape-geometry.ts";
import { BUILTIN_GEOMETRIES, type BuiltinGeometryId } from "./shapes/index.ts";

export type RenderDecoration = {
  id: string;
  /** Decoration roles from PathData (rim, fold, markers, …). */
  role: string;
};

export type ShapeDefinition = {
  id: string;
  geometry: ShapeGeometry;
  defaultSize: Size;
  minSize: Size;
  defaultPadding: Insets;
  supportedPortStrategies: PortStrategy[];
  contentPolicy: ContentPolicy;
  renderDecorations?: RenderDecoration[];
};

export type NodeTypeDefinition = {
  id: string;
  shapeId: string;
  defaultIcon?: string;
  defaultStyle?: Record<string, string>;
  contentTemplate?: string;
  defaultPorts?: Array<{ side: "north" | "east" | "south" | "west" }>;
  capabilities?: NodeCapability[];
  subtitle?: string;
  category?: string;
};

const customShapes = new Map<string, ShapeDefinition>();
const customNodeTypes = new Map<string, NodeTypeDefinition>();

function definitionFromGeometry(geometry: ShapeGeometry): ShapeDefinition {
  return {
    id: geometry.id,
    geometry,
    defaultSize: geometry.defaultSize ?? { width: 140, height: 72 },
    minSize: geometry.minSize ?? { width: 40, height: 32 },
    defaultPadding: geometry.defaultPadding ?? {
      top: 14,
      right: 16,
      bottom: 14,
      left: 16,
    },
    supportedPortStrategies: ["bbox-mid", "distributed-sides", "perimeter"],
    contentPolicy: geometry.contentPolicy ?? { align: "center", maxLabelLines: 2 },
  };
}

/** Register a custom shape without changing the renderer core. */
export function registerShape(definition: ShapeDefinition): void {
  customShapes.set(definition.id, definition);
}

export function unregisterShape(id: string): void {
  customShapes.delete(id);
}

export function getShapeDefinition(id: string): ShapeDefinition | undefined {
  const normalized = coreNormalizeShapeId(id);
  const custom = customShapes.get(normalized) ?? customShapes.get(id);
  if (custom) return custom;
  if (normalized in BUILTIN_GEOMETRIES) {
    return definitionFromGeometry(BUILTIN_GEOMETRIES[normalized as BuiltinGeometryId]);
  }
  return undefined;
}

export function getShapeGeometry(id: string): ShapeGeometry | undefined {
  return getShapeDefinition(id)?.geometry;
}

/**
 * Resolve a shape id with fallback.
 * Unknown ids fall back to rounded rectangle (same as historic SVG default).
 */
export function resolveShapeGeometry(id: string | undefined | null): ShapeGeometry {
  if (id) {
    const found = getShapeGeometry(coreNormalizeShapeId(id));
    if (found) return found;
  }
  return BUILTIN_GEOMETRIES.rounded;
}

export function listRegisteredShapeIds(): string[] {
  const builtins = Object.keys(BUILTIN_GEOMETRIES);
  const customs = [...customShapes.keys()];
  return [...new Set([...builtins, ...customs])];
}

/** Map authored shape synonyms onto registry ids (delegates to core). */
export function normalizeShapeId(shape: string | undefined | null): string {
  return coreNormalizeShapeId(shape);
}

/** Register or override a semantic node type → shape mapping. */
export function registerNodeType(definition: NodeTypeDefinition): void {
  customNodeTypes.set(definition.id, {
    ...definition,
    shapeId: coreNormalizeShapeId(definition.shapeId),
  });
}

export function unregisterNodeType(id: string): void {
  customNodeTypes.delete(id);
}

function nodeTypeFromKindCatalog(id: string): NodeTypeDefinition | undefined {
  const defaults = BUILTIN_KIND_CATALOG[id];
  if (!defaults) return undefined;
  return {
    id,
    shapeId: defaults.shape,
    defaultIcon: defaults.icon,
    defaultStyle: defaults.cssVars,
    capabilities: defaults.capabilities,
    subtitle: defaults.subtitle,
    category: defaults.category,
  };
}

export function getNodeTypeDefinition(id: string): NodeTypeDefinition | undefined {
  return customNodeTypes.get(id) ?? nodeTypeFromKindCatalog(id);
}

/**
 * Resolve the geometry for a semantic kind (with optional shape override).
 * Kind defaults come from the DSL catalog; shape overrides win.
 */
export function resolveNodeTypeGeometry(
  kind: string,
  shapeOverride?: string | null,
): ShapeGeometry {
  if (shapeOverride) return resolveShapeGeometry(shapeOverride);
  const nodeType = getNodeTypeDefinition(kind);
  return resolveShapeGeometry(nodeType?.shapeId);
}

export function listRegisteredNodeTypeIds(): string[] {
  const builtins = Object.keys(BUILTIN_KIND_CATALOG);
  const customs = [...customNodeTypes.keys()];
  return [...new Set([...builtins, ...customs])].sort();
}
