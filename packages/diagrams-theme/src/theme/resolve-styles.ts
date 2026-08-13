import type {
  GraphEdge,
  GraphNode,
  SequenceFragment,
  StyleDefinition,
} from "@kekonic/diagrams-core";
import { getKindDefaults } from "@kekonic/diagrams-core";
import { withBuiltinStyles } from "./builtin-styles.ts";

export type ResolvedStyles = {
  cssVars: Record<string, string>;
  classes: string[];
  badge?: string;
  strokeWidth?: number;
  strokeDash?: string;
};

function applyStyleDef(
  def: StyleDefinition,
  cssVars: Record<string, string>,
  badge: string | undefined,
  strokeWidth: number | undefined,
  strokeDash: string | undefined,
): { badge?: string; strokeWidth?: number; strokeDash?: string } {
  for (const [k, v] of Object.entries(def.properties)) {
    if (k.startsWith("--")) cssVars[k] = v;
    else if (k === "badge") badge = v;
    else if (k === "strokeWidth") strokeWidth = Number(v);
    else if (k === "strokeDash") strokeDash = v;
  }
  return { badge, strokeWidth, strokeDash };
}

function applyFragmentStyleDef(def: StyleDefinition, cssVars: Record<string, string>): void {
  for (const [k, v] of Object.entries(def.properties)) {
    if (k.startsWith("--")) cssVars[k] = v;
    else if (k === "fill") cssVars["--kd-sequence-fragment-fill"] = v;
    else if (k === "stroke") cssVars["--kd-sequence-fragment-stroke"] = v;
  }
}

export function resolveNodeStyles(node: GraphNode, styles: StyleDefinition[]): ResolvedStyles {
  const kindDefaults = getKindDefaults(node.kind).defaults;
  const cssVars: Record<string, string> = { ...kindDefaults.cssVars, ...node.unresolvedVars };
  let badge: string | undefined;
  let strokeWidth: number | undefined;
  let strokeDash: string | undefined;
  const catalog = withBuiltinStyles(styles);

  for (const ref of node.styleRefs) {
    const def = catalog.find((s) => s.name === ref && (s.target ?? "node") === "node");
    if (!def) continue;
    ({ badge, strokeWidth, strokeDash } = applyStyleDef(
      def,
      cssVars,
      badge,
      strokeWidth,
      strokeDash,
    ));
  }

  if (node.kind === "external" && !strokeDash) strokeDash = "5 3.5";

  // Extra kind classes (e.g. flow-shape-diamond) beyond the primary flow-node-${kind}.
  const kindClasses = kindDefaults.classNames.filter((c) => c !== `flow-node-${node.kind}`);
  const styleClasses = node.styleRefs.map((r) => `kd-style-${r.replace(/[^a-z0-9-]/gi, "")}`);

  return {
    cssVars,
    classes: [...kindClasses, ...styleClasses],
    badge,
    strokeWidth,
    strokeDash,
  };
}

export function resolveEdgeStyles(edge: GraphEdge, styles: StyleDefinition[]): ResolvedStyles {
  const cssVars: Record<string, string> = {};
  let strokeWidth: number | undefined;
  let strokeDash: string | undefined;
  const catalog = withBuiltinStyles(styles);

  for (const ref of edge.styleRefs) {
    const def = catalog.find((s) => s.name === ref && s.target === "edge");
    if (!def) continue;
    ({ strokeWidth, strokeDash } = applyStyleDef(def, cssVars, undefined, strokeWidth, strokeDash));
  }

  return {
    cssVars,
    classes: edge.styleRefs.map((r) => `kd-style-${r.replace(/[^a-z0-9-]/gi, "")}`),
    strokeWidth,
    strokeDash,
  };
}

/** Resolve semantic / authored styles onto a sequence fragment frame. */
export function resolveFragmentStyles(
  fragment: Pick<SequenceFragment, "styleRefs" | "unresolvedVars">,
  styles: StyleDefinition[],
): ResolvedStyles {
  const cssVars: Record<string, string> = { ...fragment.unresolvedVars };
  const catalog = withBuiltinStyles(styles);

  for (const ref of fragment.styleRefs) {
    const def = catalog.find((s) => s.name === ref && s.target === "fragment");
    if (!def) continue;
    applyFragmentStyleDef(def, cssVars);
  }

  return {
    cssVars,
    classes: fragment.styleRefs.map((r) => `kd-style-${r.replace(/[^a-z0-9-]/gi, "")}`),
  };
}

export function stylesToInlineCss(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
}
