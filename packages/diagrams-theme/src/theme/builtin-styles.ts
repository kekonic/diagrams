import type { StyleDefinition } from "@kekonic/diagrams-core";

/**
 * Built-in semantic styles — attach with `is danger` / `styles: [success]` without
 * declaring a `style` block. Authored styles with the same name override these.
 */

type SemanticPack = {
  aliases: string[];
  node: Record<string, string>;
  edge: Record<string, string>;
  fragment: Record<string, string>;
};

function tint(token: string, fillPct: number, strokePct: number): Record<string, string> {
  return {
    "--kd-sequence-fragment-fill": `color-mix(in srgb, var(${token}) ${fillPct}%, transparent)`,
    "--kd-sequence-fragment-stroke": `color-mix(in srgb, var(${token}) ${strokePct}%, transparent)`,
  };
}

const SEMANTICS: SemanticPack[] = [
  {
    aliases: ["danger", "dangerous", "error", "fail", "failed", "failure"],
    node: {
      "--node-fill": "var(--kd-danger-fill)",
      "--node-stroke": "var(--kd-danger)",
      "--node-title-fill": "var(--kd-on-danger)",
      badge: "!",
    },
    edge: { "--edge-stroke": "var(--kd-danger)", strokeWidth: "2.4" },
    fragment: tint("--kd-danger", 3.5, 34),
  },
  {
    aliases: ["warning", "warn", "caution"],
    node: {
      "--node-fill": "var(--kd-warning-fill)",
      "--node-stroke": "var(--kd-warning-stroke)",
      "--node-title-fill": "var(--kd-on-warning)",
      badge: "!",
    },
    edge: { "--edge-stroke": "var(--kd-warning)", strokeWidth: "2.2" },
    fragment: tint("--kd-warning", 3.5, 32),
  },
  {
    aliases: ["success", "ok", "pass"],
    node: {
      "--node-fill": "var(--kd-success-fill)",
      "--node-stroke": "var(--kd-success-stroke)",
      "--node-title-fill": "var(--kd-on-success)",
      badge: "✓",
    },
    edge: { "--edge-stroke": "var(--kd-success)", strokeWidth: "2.2" },
    fragment: tint("--kd-success", 3.5, 32),
  },
  {
    aliases: ["critical"],
    node: {
      "--node-fill": "var(--kd-danger-fill)",
      "--node-stroke": "var(--kd-danger)",
      "--node-title-fill": "var(--kd-on-danger)",
      badge: "!",
      strokeWidth: "2.6",
    },
    edge: { "--edge-stroke": "var(--kd-danger)", strokeWidth: "3" },
    fragment: tint("--kd-danger", 5, 40),
  },
  {
    aliases: ["muted", "deprecated", "inactive"],
    node: {
      "--node-fill": "var(--kd-surface)",
      "--node-stroke": "var(--kd-muted)",
      "--node-title-fill": "var(--kd-on-muted)",
      strokeDash: "5 3.5",
    },
    edge: { "--edge-stroke": "var(--kd-muted)", strokeDash: "5 3.5" },
    fragment: tint("--kd-muted", 2.5, 26),
  },
  {
    aliases: ["info", "accent"],
    node: {
      "--node-fill": "var(--kd-service-fill)",
      "--node-stroke": "var(--kd-accent)",
    },
    edge: { "--edge-stroke": "var(--kd-accent)" },
    fragment: tint("--kd-accent", 3, 28),
  },
];

function stylesFor(
  target: "node" | "edge" | "fragment",
  names: string[],
  properties: Record<string, string>,
): StyleDefinition[] {
  return names.map((name) => ({ name, target, properties: { ...properties } }));
}

/** Canonical names users should prefer in docs (`is danger`, not only aliases). */
export const BUILTIN_SEMANTIC_STYLE_NAMES = [
  "danger",
  "warning",
  "success",
  "critical",
  "muted",
  "info",
] as const;

export type BuiltinSemanticStyleName = (typeof BUILTIN_SEMANTIC_STYLE_NAMES)[number];

export const BUILTIN_STYLE_DEFINITIONS: readonly StyleDefinition[] = SEMANTICS.flatMap((pack) => [
  ...stylesFor("node", pack.aliases, pack.node),
  ...stylesFor("edge", pack.aliases, pack.edge),
  ...stylesFor("fragment", pack.aliases, pack.fragment),
]);

/** Merge authored styles over builtins (same name + target wins for authored). */
export function withBuiltinStyles(authored: StyleDefinition[]): StyleDefinition[] {
  const key = (s: StyleDefinition) => `${s.target ?? "node"}:${s.name}`;
  const map = new Map<string, StyleDefinition>();
  for (const s of BUILTIN_STYLE_DEFINITIONS) map.set(key(s), s);
  for (const s of authored) map.set(key(s), s);
  return [...map.values()];
}
