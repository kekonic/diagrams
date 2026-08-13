/** Padding — uniform number or per-side box. */
export type PaddingSpec = number | { top?: number; right?: number; bottom?: number; left?: number };

/** Only as-authored — no silent case transforms. */
export type LabelCasePolicy = "as-authored";

export type TitleSpec =
  | false
  | true
  | "auto"
  | {
      text?: string;
      subtitle?: string;
      align?: "start" | "center";
    };

/**
 * Opt-in presentation chrome. Omitted options yield embeddable, transparent SVG.
 * There are no presets — set fields explicitly when you want title, accents, etc.
 */
export type PresentationOptions = {
  title?: TitleSpec;
  /** Outer inset around the full rendered canvas (including chrome). */
  padding?: PaddingSpec;
  /** Gap between chrome elements (title block) and diagram content. */
  contentPadding?: PaddingSpec;
  labelCase?: LabelCasePolicy;
  /**
   * When true, stamp built-in kind eyebrows (Service, Gateway, …) under every node.
   * Prefer per-node `subtitle: "…"` for authored captions. Default false.
   */
  showKindSubtitles?: boolean;
  /**
   * When true, paint small dots where edges meet node silhouettes.
   * Dot fill matches the edge stroke. Default false.
   */
  showEndpoints?: boolean;
  /** Tint group bands for review readability. */
  groupAccent?: boolean;
  /** Keep edge labels inside the diagram bounds (default true). */
  clampLabels?: boolean;
};

export type ResolvedPadding = { top: number; right: number; bottom: number; left: number };

export type ResolvedTitle =
  | false
  | {
      text: string;
      subtitle?: string;
      align: "start" | "center";
    };

/** Fully resolved presentation — no undefined fields. */
export type ResolvedPresentation = {
  title: ResolvedTitle;
  padding: ResolvedPadding;
  contentPadding: ResolvedPadding;
  labelCase: LabelCasePolicy;
  showKindSubtitles: boolean;
  showEndpoints: boolean;
  groupAccent: boolean;
  clampLabels: boolean;
};

/** Props removed from the presentation DSL — emit a diagnostic instead of ignoring. */
export const REMOVED_PRESENTATION_PROPS = [
  "preset",
  "background",
  "grid",
  "frame",
  "legend",
  "nodeGradient",
  "groupHeaders",
] as const;

export type RemovedPresentationProp = (typeof REMOVED_PRESENTATION_PROPS)[number];

export function normalizePadding(spec: PaddingSpec | undefined, fallback = 0): ResolvedPadding {
  if (spec == null) {
    return { top: fallback, right: fallback, bottom: fallback, left: fallback };
  }
  if (typeof spec === "number") {
    return { top: spec, right: spec, bottom: spec, left: spec };
  }
  return {
    top: spec.top ?? fallback,
    right: spec.right ?? fallback,
    bottom: spec.bottom ?? fallback,
    left: spec.left ?? fallback,
  };
}

const BASE_DEFAULTS: PresentationOptions = {
  title: false,
  labelCase: "as-authored",
  showKindSubtitles: false,
  showEndpoints: false,
  groupAccent: false,
  clampLabels: true,
};

function resolveTitle(title: TitleSpec | undefined, graphTitle?: string): ResolvedTitle {
  if (title === false || title == null) return false;
  if (title === true || title === "auto") {
    if (!graphTitle) return false;
    return { text: graphTitle, align: "start" };
  }
  if (typeof title === "object") {
    const text = title.text ?? graphTitle;
    if (!text) return false;
    return {
      text,
      subtitle: title.subtitle,
      align: title.align ?? "start",
    };
  }
  return false;
}

/** Merge explicit options onto chromeless defaults. */
export function resolvePresentation(
  options: PresentationOptions | undefined,
  graphTitle?: string,
): ResolvedPresentation {
  const merged: PresentationOptions = {
    ...BASE_DEFAULTS,
    ...options,
  };

  return {
    title: resolveTitle(merged.title, graphTitle),
    padding: normalizePadding(merged.padding, 0),
    contentPadding: normalizePadding(merged.contentPadding, 0),
    labelCase: "as-authored",
    showKindSubtitles: merged.showKindSubtitles === true,
    showEndpoints: merged.showEndpoints === true,
    groupAccent: merged.groupAccent === true,
    clampLabels: merged.clampLabels !== false,
  };
}

/** Parse a DSL property map into PresentationOptions. */
export function presentationFromProperties(props: Record<string, unknown>): PresentationOptions {
  const out: PresentationOptions = {};

  const str = (key: string): string | undefined => {
    const v = props[key];
    return typeof v === "string" ? v : undefined;
  };
  const bool = (key: string): boolean | undefined => {
    const v = props[key];
    if (typeof v === "boolean") return v;
    if (v === "true") return true;
    if (v === "false") return false;
    return undefined;
  };
  const num = (key: string): number | undefined => {
    const v = props[key];
    return typeof v === "number" ? v : undefined;
  };

  const titleVal = props.title;
  const titleSubtitle = str("titleSubtitle");
  const titleAlign = str("titleAlign") as "start" | "center" | undefined;
  if (titleVal === false || titleVal === "false" || titleVal === "none") out.title = false;
  else if (titleVal === true || titleVal === "true" || titleVal === "auto") {
    if (titleSubtitle || titleAlign) {
      out.title = { subtitle: titleSubtitle, align: titleAlign };
    } else {
      out.title = titleVal === "auto" ? "auto" : true;
    }
  } else if (typeof titleVal === "string") {
    out.title = {
      text: titleVal,
      subtitle: titleSubtitle,
      align: titleAlign,
    };
  } else if (titleSubtitle || titleAlign) {
    out.title = { subtitle: titleSubtitle, align: titleAlign };
  }

  const padding = num("padding");
  if (padding != null) out.padding = padding;

  const contentPadding = num("contentPadding");
  if (contentPadding != null) out.contentPadding = contentPadding;

  out.labelCase = "as-authored";

  const showKindSubtitles = bool("showKindSubtitles");
  if (showKindSubtitles != null) out.showKindSubtitles = showKindSubtitles;

  const showEndpoints = bool("showEndpoints");
  if (showEndpoints != null) out.showEndpoints = showEndpoints;

  // `auto` was a synonym — treat as true; prefer boolean in docs.
  if (props.groupAccent === "auto") out.groupAccent = true;
  else {
    const b = bool("groupAccent");
    if (b != null) out.groupAccent = b;
  }

  const clampLabels = bool("clampLabels");
  if (clampLabels != null) out.clampLabels = clampLabels;

  return out;
}

/**
 * Pick the case policy for a concrete label.
 * Quoted / authored labels are never rewritten.
 */
export function displayLabelCase(
  _labelAuthored: boolean | undefined,
  _policy: LabelCasePolicy,
): LabelCasePolicy {
  return "as-authored";
}

export function formatLabelText(text: string, _policy: LabelCasePolicy): string {
  return text;
}

/** Shallow-merge presentation layers (later wins). */
export function mergePresentationOptions(
  ...layers: (PresentationOptions | undefined)[]
): PresentationOptions | undefined {
  let result: PresentationOptions | undefined;
  for (const layer of layers) {
    if (!layer) continue;
    result = { ...result, ...layer };
  }
  return result;
}
