/** Editorial / epistemic metadata for a view or standalone diagram. Not rendered into SVG. */
export type ViewIntent = {
  audience?: string;
  question?: string;
  /** Declared scope ids or shorthand labels for lint/agent tooling. */
  scope?: string[];
  omits?: string;
  assumptions?: string;
  evidence?: string[];
};

/** Identifies which view produced a compiled graph. */
export type ViewProvenance = {
  name: string;
  modelId: string;
  modelTitle?: string;
};
