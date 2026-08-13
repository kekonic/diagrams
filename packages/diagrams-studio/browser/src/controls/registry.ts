import type { StudioOptions } from "../lib/buildRenderOptions.ts";

export type ControlSection = "appearance" | "layout" | "edges";

type SelectOption = {
  value: string;
  label: string;
  /** Compact label for segment buttons; falls back to label. */
  shortLabel?: string;
  title?: string;
};

type BaseControl = {
  id: keyof StudioOptions;
  section: ControlSection;
  label: string;
  title?: string;
};

export type SelectControlDef = BaseControl & {
  kind: "select";
  options: SelectOption[];
};

/** Horizontal (wrapping) exclusive choices — faster than a dropdown for ≤ ~6 options. */
export type SegmentControlDef = BaseControl & {
  kind: "segment";
  options: SelectOption[];
};

export type RangeControlDef = BaseControl & {
  kind: "range";
  min: number;
  max: number;
  step: number;
  /** Display when value is null (inherit). */
  nullLabel?: string;
  format?: (value: number) => string;
};

export type ToggleControlDef = BaseControl & {
  kind: "toggle";
};

export type ControlDef = SelectControlDef | SegmentControlDef | RangeControlDef | ToggleControlDef;

/** Empty-value option: inherit diagram source / engine defaults. */
const AUTO = { value: "", label: "Auto", shortLabel: "Auto" } as const;

/**
 * Declarative control registry — add an entry here to grow Adjust drawer.
 * Empty select/segment value / null range = do not override source.
 *
 * UX guide:
 * - segment: ≤6 exclusive named choices (esp. ordinal / spatial)
 * - range: continuous scales
 * - select: long lists or labels that need full words
 */
export const CONTROL_REGISTRY: ControlDef[] = [
  {
    id: "theme",
    section: "appearance",
    label: "Theme",
    kind: "segment",
    title: "The exported palette. This updates render.theme in the diagram source.",
    options: [
      { value: "dark", label: "Dark" },
      { value: "light", label: "Light" },
    ],
  },
  {
    id: "direction",
    section: "layout",
    label: "Direction",
    kind: "segment",
    title: "Auto follows direction in the diagram source",
    options: [
      AUTO,
      { value: "TD", label: "Top → down", shortLabel: "↓", title: "Top → down" },
      { value: "LR", label: "Left → right", shortLabel: "→", title: "Left → right" },
      { value: "BT", label: "Bottom → top", shortLabel: "↑", title: "Bottom → top" },
      { value: "RL", label: "Right → left", shortLabel: "←", title: "Right → left" },
    ],
  },
  {
    id: "density",
    section: "layout",
    label: "Density",
    kind: "segment",
    title: "Auto follows density in the diagram source",
    options: [
      AUTO,
      { value: "compact", label: "Compact", shortLabel: "Tight" },
      { value: "normal", label: "Normal", shortLabel: "Normal" },
      { value: "spacious", label: "Spacious", shortLabel: "Loose" },
    ],
  },
  {
    id: "groupLayout",
    section: "layout",
    label: "Groups",
    kind: "segment",
    title: "How groups participate in layout. This updates layout.groupLayout in the source.",
    options: [
      AUTO,
      { value: "auto", label: "Engine", shortLabel: "Engine" },
      { value: "compound", label: "Nested", shortLabel: "Nest" },
      { value: "flat", label: "Flat" },
      { value: "swimlane", label: "Lanes", shortLabel: "Lanes" },
    ],
  },
  {
    id: "edgeStyle",
    section: "edges",
    label: "Edge style",
    kind: "segment",
    title: "Auto follows edges.route in the diagram source",
    options: [
      AUTO,
      { value: "metro", label: "Metro", shortLabel: "Metro" },
      { value: "rounded", label: "Rounded", shortLabel: "Round" },
      { value: "orthogonal", label: "Orthogonal", shortLabel: "Ortho" },
      { value: "straight", label: "Straight", shortLabel: "Line" },
      { value: "bezier", label: "Bezier", shortLabel: "Curve" },
    ],
  },
  {
    id: "crossings",
    section: "edges",
    label: "Crossings",
    kind: "segment",
    title: "Auto follows edges.crossings in the diagram source",
    options: [
      AUTO,
      { value: "jumps", label: "Jumps" },
      { value: "smart", label: "Smart" },
      { value: "gaps", label: "Gaps" },
      { value: "none", label: "None" },
    ],
  },
];

export function controlsFor(section: ControlSection): ControlDef[] {
  return CONTROL_REGISTRY.filter((control) => control.section === section);
}
