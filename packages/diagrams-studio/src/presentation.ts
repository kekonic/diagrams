import type { InteractiveRenderOptions, LayoutOptions, ThemeMode } from "@kekonic/diagrams";

export type StudioPresentationControls = {
  /** Diagram palette authored through `render.theme`. */
  theme: "dark" | "light";
  direction: "" | "LR" | "RL" | "TD" | "BT";
  density: "" | "compact" | "normal" | "spacious";
  spacingScale: number | null;
  nodePlacement: "" | "straight" | "balanced" | "basic";
  groupLayout: "" | "auto" | "compound" | "flat" | "swimlane";
  modelOrder: "" | "on" | "off";
  groupGap: "" | "40" | "90" | "170";
  edgeGaps: "" | "tight" | "normal" | "wide";
  edgeStyle: "" | "metro" | "rounded" | "orthogonal" | "straight" | "bezier";
  crossings: "" | "jumps" | "smart" | "gaps" | "none";
  roundedCorners: boolean;
  showPorts: boolean;
  showBounds: boolean;
};

export const DEFAULT_STUDIO_PRESENTATION: StudioPresentationControls = {
  theme: "dark",
  direction: "",
  density: "",
  spacingScale: null,
  nodePlacement: "",
  groupLayout: "",
  modelOrder: "",
  groupGap: "",
  edgeGaps: "",
  edgeStyle: "",
  crossings: "",
  roundedCorners: false,
  showPorts: false,
  showBounds: false,
};

const EDGE_GAP_PRESETS = {
  tight: { edgeNodeSpacing: 28, edgeEdgeSpacing: 14, edgeLabelSpacing: 10 },
  normal: { edgeNodeSpacing: 36, edgeEdgeSpacing: 28, edgeLabelSpacing: 16 },
  wide: { edgeNodeSpacing: 72, edgeEdgeSpacing: 56, edgeLabelSpacing: 28 },
} as const;

export function buildStudioRenderOptions(
  options: StudioPresentationControls,
  diagramTheme: ThemeMode = options.theme,
): InteractiveRenderOptions {
  const layout: LayoutOptions = {};
  if (options.spacingScale != null) layout.spacingScale = options.spacingScale;
  if (options.density) layout.density = options.density;
  if (options.direction) layout.direction = options.direction;
  if (options.nodePlacement) layout.nodePlacement = options.nodePlacement;
  if (options.groupLayout) layout.groupLayout = options.groupLayout;
  if (options.modelOrder === "on") layout.considerModelOrder = true;
  if (options.modelOrder === "off") layout.considerModelOrder = false;
  if (options.groupGap) layout.groupGap = Number(options.groupGap);
  if (options.edgeGaps) Object.assign(layout, EDGE_GAP_PRESETS[options.edgeGaps]);

  const edges: InteractiveRenderOptions["edges"] = {};
  if (options.edgeStyle) edges.route = options.edgeStyle;
  if (options.crossings) edges.crossings = options.crossings;
  return {
    theme: diagramTheme,
    layout,
    edges,
    ...(options.roundedCorners ? { roundedCorners: true } : {}),
    debug: { showPorts: options.showPorts, showBounds: options.showBounds },
  };
}
