import type { Diagnostic, SourceRange } from "../types/geometry.ts";
import type { GraphModel } from "../types/graph.ts";
import type { ViewIntent } from "../types/view-intent.ts";

const OMIT_KIND_RULES: Array<{ pattern: RegExp; kinds: string[]; label: string }> = [
  { pattern: /\bcontainers?\b/i, kinds: ["container"], label: "containers" },
  { pattern: /\bdatabases?\b/i, kinds: ["database", "table", "entity"], label: "databases" },
  { pattern: /\bcomponents?\b/i, kinds: ["component"], label: "components" },
  {
    pattern: /\btopics?\b|\bbrokers?\b|\bevents?\b/i,
    kinds: ["topic", "broker", "queue", "dlq"],
    label: "event infrastructure",
  },
];

/** Verify declared view intent against the projected graph. */
export function lintViewIntent(
  graph: GraphModel,
  intent: ViewIntent | undefined,
  range: SourceRange,
): Diagnostic[] {
  if (!intent) return [];
  const diagnostics: Diagnostic[] = [];

  if (!intent.question?.trim()) {
    diagnostics.push({
      severity: "warning",
      code: "FM230",
      message: "View intent does not declare a reader question",
      range,
      hint: "Add `question:` so agents and reviewers know what this lens must answer.",
    });
  }

  if (intent.omits) {
    for (const rule of OMIT_KIND_RULES) {
      if (!rule.pattern.test(intent.omits)) continue;
      const leaked = graph.nodes.filter((node) => rule.kinds.includes(node.kind));
      if (leaked.length === 0) continue;
      diagnostics.push({
        severity: "warning",
        code: "FM231",
        message: `View omits ${rule.label} but shows ${leaked.map((node) => node.id).join(", ")}`,
        range,
        hint: `Remove ${leaked.map((node) => node.id).join(", ")} from the projection or revise intent.omits.`,
      });
    }
  }

  if (intent.scope && intent.scope.length > 0) {
    const allowed = new Set(intent.scope);
    for (const node of graph.nodes) {
      if (allowed.has(node.id) || allowed.has("*")) continue;
      if (
        intent.scope.some((entry) => entry.endsWith(".*") && matchesScopePrefix(entry, node.id))
      ) {
        continue;
      }
      diagnostics.push({
        severity: "warning",
        code: "FM232",
        message: `Node "${node.id}" is visible but not listed in intent.scope`,
        range: node.sourceRange ?? range,
        hint: "Extend scope, adjust include/exclude, or remove scope when the view is intentionally broader.",
      });
    }
  }

  return diagnostics;
}

function matchesScopePrefix(entry: string, nodeId: string): boolean {
  const prefix = entry.slice(0, -2);
  return nodeId === prefix || nodeId.startsWith(`${prefix}.`);
}
