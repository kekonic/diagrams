/** Compiled / derived branch outcome for edges (layout + theme share this). */
export type BranchKind = "yes" | "no" | "neutral";

/**
 * Classify an edge label into a yes/no/neutral branch cue.
 * Only clear affirmative/negative tokens — use `branch: yes|no` for outcome wording.
 */
export function classifyBranch(label?: string): BranchKind {
  if (!label) return "neutral";
  const normalized = label.trim().toLowerCase();

  if (/^(yes|y|true|ok)\b/.test(normalized) || normalized === "yes") return "yes";
  if (/^(no|n|false)\b/.test(normalized) || normalized === "no") return "no";
  if (/\byes\b/.test(normalized) && !/\bno\b/.test(normalized)) return "yes";
  if (/\bno\b/.test(normalized) && !/\byes\b/.test(normalized)) return "no";
  return "neutral";
}

export function normalizeBranch(value: unknown): BranchKind | undefined {
  if (value === "yes" || value === "no" || value === "neutral") return value;
  return undefined;
}
