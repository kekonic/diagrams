import {
  BUILTIN_KIND_CATALOG,
  BUILTIN_SHAPE_IDS,
  EDGE_OPS,
  STATEMENT_KEYWORDS,
} from "@kekonic/diagrams-core";
import { listBuiltinIconIds, listDefaultCollections } from "@kekonic/diagrams-icons";
import { ELK_LAYOUT_ALGORITHM, ELK_ROUTER_ALGORITHM } from "@kekonic/diagrams-layout";
import { QUALITY_CHECKS } from "./quality.ts";

export const KDIAGRAM_CAPABILITIES_VERSION = 1 as const;

export type KDiagramCapabilities = {
  version: 1;
  registryScope: "built-in";
  language: {
    version: 1;
    documentVersions: readonly [1, 2];
    diagramFamilies: readonly ["flow", "state", "sequence"];
    statementKeywords: string[];
    edgeOperators: string[];
    draftFeatures?: readonly string[];
  };
  nodes: Array<{
    id: string;
    category: string;
    shape: string;
    subtitle: string;
    capabilities: string[];
    defaultIcon?: string;
  }>;
  shapes: string[];
  icons: { builtin: string[]; collections: string[] };
  layout: {
    algorithm: string;
    router: string;
    directions: readonly ["LR", "RL", "TD", "BT"];
    densities: readonly ["compact", "normal", "spacious"];
    groupLayouts: readonly ["compound", "swimlane"];
    regionArrangements: readonly ["stack", "row", "grid"];
  };
  presentation: {
    themes: readonly ["dark", "light"];
    exportFormats: readonly ["svg"];
    themeModes: readonly ["snapshot", "live"];
  };
  qualityChecks: string[];
};

/** Deterministic, JSON-safe description of the active built-in KDiagram surface. */
export function getCapabilities(): KDiagramCapabilities {
  return {
    version: KDIAGRAM_CAPABILITIES_VERSION,
    registryScope: "built-in",
    language: {
      version: 1,
      documentVersions: [1, 2],
      diagramFamilies: ["flow", "state", "sequence"],
      statementKeywords: [...STATEMENT_KEYWORDS].sort(),
      edgeOperators: [...EDGE_OPS],
      draftFeatures: ["intent", "model", "view", "include", "exclude", "collapse"],
    },
    nodes: Object.entries(BUILTIN_KIND_CATALOG)
      .map(([id, kind]) => ({
        id,
        category: kind.category,
        shape: kind.shape,
        subtitle: kind.subtitle,
        capabilities: [...kind.capabilities].sort(),
        ...(kind.icon ? { defaultIcon: kind.icon } : {}),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    shapes: [...BUILTIN_SHAPE_IDS].sort(),
    icons: {
      builtin: listBuiltinIconIds().sort(),
      collections: listDefaultCollections().sort(),
    },
    layout: {
      algorithm: ELK_LAYOUT_ALGORITHM,
      router: ELK_ROUTER_ALGORITHM,
      directions: ["LR", "RL", "TD", "BT"],
      densities: ["compact", "normal", "spacious"],
      groupLayouts: ["compound", "swimlane"],
      regionArrangements: ["stack", "row", "grid"],
    },
    presentation: {
      themes: ["dark", "light"],
      exportFormats: ["svg"],
      themeModes: ["snapshot", "live"],
    },
    qualityChecks: [...QUALITY_CHECKS],
  };
}
