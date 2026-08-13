import type { ParsedIconId } from "./types.ts";

const QUALIFIED = /^([a-z0-9][a-z0-9_-]*):([a-z0-9][a-z0-9_-]*)$/i;

/** Short names that map to KDiagram's built-in stroke glyphs. */
export const BUILTIN_ICON_NAMES = [
  "database",
  "queue",
  "user",
  "choice",
  "success",
  "warning",
  "gateway",
  "event",
  "server",
  "note",
  "service",
] as const;

export type BuiltinIconName = (typeof BUILTIN_ICON_NAMES)[number];

/**
 * Friendly aliases → Iconify (or builtin) ids.
 * Bare Lucide names work without a prefix (`icon: shopping-cart` → `lucide:shopping-cart`).
 */
export const BUILTIN_ICON_ALIASES: Record<string, string> = {
  cart: "lucide:shopping-cart",
  cloud: "lucide:cloud",
  api: "lucide:waypoints",
  person: "lucide:user",
  actor: "lucide:user",
  lambda: "logos:aws-lambda",
  aws: "logos:aws",
  azure: "logos:microsoft-azure",
  gcp: "logos:google-cloud",
  k8s: "logos:kubernetes",
  docker: "logos:docker",
  postgres: "logos:postgresql",
  redis: "logos:redis",
  kafka: "logos:kafka",
  github: "logos:github-icon",
  vercel: "simple-icons:vercel",
};

/** Normalize raw DSL / kind icon strings into `prefix:name`. */
export function normalizeIconId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "none") return "none";
  const alias = BUILTIN_ICON_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  if (QUALIFIED.test(trimmed)) return trimmed.toLowerCase();
  if ((BUILTIN_ICON_NAMES as readonly string[]).includes(trimmed.toLowerCase())) {
    return `builtin:${trimmed.toLowerCase()}`;
  }
  // Bare unknown names map to Lucide (any Lucide icon by kebab-case name).
  return `lucide:${trimmed.toLowerCase()}`;
}

export function parseIconId(raw: string): ParsedIconId | null {
  const id = normalizeIconId(raw);
  if (id === "none") return null;
  const m = QUALIFIED.exec(id);
  if (!m) return null;
  return { prefix: m[1]!.toLowerCase(), name: m[2]!.toLowerCase(), id };
}

export function listBuiltinIconIds(): string[] {
  return BUILTIN_ICON_NAMES.map((n) => `builtin:${n}`);
}
