import type { TableColumn } from "./table.ts";

export type DocumentFieldRole = "partition" | "sort" | "reference" | "materialized";

const ROLE_WORDS: Record<string, DocumentFieldRole> = {
  partition: "partition",
  sort: "sort",
  ref: "reference",
  reference: "reference",
  copy: "materialized",
  materialized: "materialized",
};

/** Leading `>` markers encode nesting in the stored field spec. */
export function documentFieldDepth(raw: string): number {
  return raw.match(/^(>*)/)?.[1]?.length ?? 0;
}

/**
 * Parse one document field spec.
 *
 * `employeeId: string required partition`
 * `>startsAt: datetime required // local`
 */
export function parseDocumentFieldSpec(raw: string): TableColumn | null {
  let text = raw.trim();
  if (!text) return null;
  let depth = 0;
  while (text.startsWith(">")) {
    depth += 1;
    text = text.slice(1).trimStart();
  }

  let note: string | undefined;
  const noteSplit = text.split(/\s+\/\/\s+/);
  if (noteSplit.length > 1) {
    text = noteSplit[0]!.trim();
    note = noteSplit.slice(1).join(" // ").trim() || undefined;
  }

  const parts = text
    .replace(/\s*:\s*/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return null;

  const name = parts[0]!;
  const roles: DocumentFieldRole[] = [];
  let required = false;
  const typeParts: string[] = [];
  for (const token of parts.slice(1)) {
    const lower = token.toLowerCase();
    if (lower === "required" || lower === "nn") {
      required = true;
      continue;
    }
    if (lower === "optional") continue;
    const role = ROLE_WORDS[lower];
    if (role) {
      if (!roles.includes(role)) roles.push(role);
      continue;
    }
    typeParts.push(token);
  }

  return {
    name,
    type: typeParts.length ? typeParts.join(" ") : undefined,
    keys: [],
    notNull: required || undefined,
    note,
    depth,
    roles: roles.length ? roles : undefined,
  };
}

export function parseDocumentFields(raw: unknown): TableColumn[] {
  if (!Array.isArray(raw)) return [];
  const fields: TableColumn[] = [];
  for (const item of raw) {
    const field = parseDocumentFieldSpec(String(item));
    if (field) fields.push(field);
  }
  return fields;
}

/** Print a field without its depth prefix. Nested braces are the printer's job. */
export function formatDocumentFieldLine(col: TableColumn): string {
  const flags: string[] = [];
  if (col.type) flags.push(col.type);
  if (col.notNull) flags.push("required");
  for (const role of col.roles ?? []) {
    if (role === "reference") flags.push("ref");
    else if (role === "materialized") flags.push("copy");
    else flags.push(role);
  }
  let line = col.name;
  if (flags.length) line += `: ${flags.join(" ")}`;
  if (col.note) line += ` // ${col.note}`;
  return line;
}
