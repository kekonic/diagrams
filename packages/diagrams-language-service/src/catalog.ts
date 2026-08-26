import {
  BUILTIN_KIND_CATALOG,
  BUILTIN_KIND_LIST,
  BUILTIN_SHAPE_IDS,
  EDGE_OPS,
} from "@kekonic/diagrams-core";
import { listBuiltinIconIds } from "@kekonic/diagrams-icons";
import { BUILTIN_SEMANTIC_STYLE_NAMES, getThemeTokens } from "@kekonic/diagrams-theme";
import type { SemanticProperty } from "./types.ts";

export const LANGUAGE_KEYWORDS = [
  "diagram",
  "state",
  "sequence",
  "model",
  "view",
  "intent",
  "include",
  "exclude",
  "collapse",
  "group",
  "boundary",
  "zone",
  "swimlane",
  "style",
  "animation",
  "direction",
  "density",
  "layout",
  "edges",
  "render",
  "presentation",
  "activate",
  "deactivate",
  "create",
  "destroy",
  "note",
  "autonumber",
  "alt",
  "else",
  "opt",
  "loop",
  "par",
] as const;

export const BUILTIN_PROPERTIES: readonly SemanticProperty[] = [
  { name: "label", description: "Visible label for the element." },
  { name: "subtitle", description: "Secondary text shown beneath the label." },
  { name: "description", description: "Longer body text under the title (C4 description)." },
  { name: "technology", description: "Runtime or platform tag shown on architecture nodes." },
  { name: "icon", description: "Built-in or collection-qualified icon identifier." },
  { name: "shape", description: "Geometry used to draw the node.", values: BUILTIN_SHAPE_IDS },
  { name: "columns", description: "ERD table column declarations." },
  {
    name: "cardinality",
    description: "ERD relationship multiplicity drawn as crow's-foot markers, e.g. 1:N or 0..1:1.",
  },
  {
    name: "identifying",
    description: "ERD identifying relationship (solid) versus non-identifying (dashed).",
    values: ["true", "false"],
  },
  { name: "note", description: "Short note on a table, node, or column." },
  {
    name: "audience",
    description: "Intent: who the view is for (metadata; not drawn in SVG).",
  },
  {
    name: "question",
    description: "Intent: the one question this view answers.",
  },
  {
    name: "scope",
    description: "Intent: ids or labels that belong in this lens.",
  },
  {
    name: "omits",
    description: "Intent: what this view deliberately leaves out.",
  },
  {
    name: "assumptions",
    description: "Intent: assumptions the reader should know.",
  },
  {
    name: "evidence",
    description: "Intent: sources that ground the view.",
  },
  {
    name: "direction",
    description: "Diagram reading direction.",
    values: ["LR", "RL", "TD", "BT"],
  },
  {
    name: "density",
    description: "Layout spacing policy.",
    values: ["compact", "normal", "spacious"],
  },
  {
    name: "route",
    description:
      "Edge path style after layout. Metro/rounded/orthogonal paint the orthogonal corridor; straight uses a port-to-port chord when clear; bezier is an obstacle-aware cubic along that corridor.",
    values: ["straight", "bezier", "orthogonal", "rounded", "metro"],
  },
  { name: "stroke", description: "Authored stroke color or theme-token reference." },
  { name: "fill", description: "Authored fill color or theme-token reference." },
  {
    name: "arrange",
    description: "Group content arrangement.",
    values: ["flow", "pack", "stack", "row", "grid"],
  },
  {
    name: "align",
    description: "Group content alignment.",
    values: ["stretch", "start", "center", "end"],
  },
  { name: "gap", description: "Explicit group gap." },
  { name: "row", description: "Grid row placement." },
  { name: "column", description: "Grid column placement." },
  { name: "rowSpan", description: "Number of grid rows occupied." },
  { name: "colSpan", description: "Number of grid columns occupied." },
] as const;

export const builtinCatalog = {
  kinds: BUILTIN_KIND_LIST,
  kindDetails: BUILTIN_KIND_CATALOG,
  shapes: BUILTIN_SHAPE_IDS,
  edgeOperators: EDGE_OPS,
  icons: listBuiltinIconIds(),
  styles: BUILTIN_SEMANTIC_STYLE_NAMES,
  themeTokens: Object.keys(getThemeTokens("dark")).sort(),
  properties: BUILTIN_PROPERTIES,
} as const;
