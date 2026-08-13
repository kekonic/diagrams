/** Column key roles for ERD-style table nodes. */
export type TableColumnKey = "pk" | "fk" | "uk";

export type TableColumnRef = {
  /** Referenced table / entity node id. */
  table: string;
  /** Referenced column name (usually a PK). */
  column: string;
};

export type TableColumn = {
  /** Column / attribute name. */
  name: string;
  /** SQL-ish or conceptual type (e.g. uuid, text, timestamptz). */
  type?: string;
  /** Primary / foreign / unique key markers (order preserved). */
  keys: TableColumnKey[];
  /** NOT NULL */
  notNull?: boolean;
  /** FK target — e.g. from `"customer_id FK uuid -> customers.id"`. */
  references?: TableColumnRef;
  /** Optional short note shown muted after the type. */
  note?: string;
};

const FLAG_TOKENS = new Set([
  "PK",
  "PRIMARY",
  "FK",
  "FOREIGN",
  "UK",
  "UNIQUE",
  "NN",
  "NOTNULL",
  "NOT_NULL",
]);

/**
 * Parse a compact column spec string into a structured column.
 *
 * Accepted forms (whitespace-separated):
 * - `"id PK uuid"`
 * - `"email text UK NN"`
 * - `"customer_id : uuid FK"`
 * - `"customer_id FK uuid -> customers.id"`
 * - `"status text NN // order lifecycle"` (note after //)
 *
 * Flags: PK, FK, UK/UNIQUE, NN/NOT NULL/NOTNULL (case-insensitive).
 */
export function parseTableColumnSpec(raw: string): TableColumn | null {
  let trimmed = raw.trim();
  if (!trimmed) return null;

  let note: string | undefined;
  const noteSplit = trimmed.split(/\s+\/\/\s+/);
  if (noteSplit.length > 1) {
    trimmed = noteSplit[0]!.trim();
    note = noteSplit.slice(1).join(" // ").trim() || undefined;
  }

  let references: TableColumnRef | undefined;
  const refMatch = trimmed.match(/^(.*?)\s*->\s*([A-Za-z_][\w-]*)\.([A-Za-z_][\w-]*)\s*$/);
  if (refMatch) {
    trimmed = refMatch[1]!.trim();
    references = { table: refMatch[2]!, column: refMatch[3]! };
  } else {
    const refWord = trimmed.match(
      /^(.*?)\s+(?:ref|references)\s+([A-Za-z_][\w-]*)\.([A-Za-z_][\w-]*)\s*$/i,
    );
    if (refWord) {
      trimmed = refWord[1]!.trim();
      references = { table: refWord[2]!, column: refWord[3]! };
    }
  }

  // Allow "name : type FLAGS" as well as free-order tokens.
  const normalized = trimmed.replace(/\s*:\s*/g, " ");
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const name = parts[0]!;
  const keys: TableColumnKey[] = [];
  let notNull = false;
  const typeParts: string[] = [];

  for (let i = 1; i < parts.length; i++) {
    const token = parts[i]!;
    const upper = token.toUpperCase();
    // Accept "NOT NULL" as two tokens (in addition to NN / NOTNULL / NOT_NULL).
    if (upper === "NOT" && parts[i + 1]?.toUpperCase() === "NULL") {
      notNull = true;
      i++;
      continue;
    }
    switch (upper) {
      case "PK":
      case "PRIMARY":
        if (!keys.includes("pk")) keys.push("pk");
        break;
      case "FK":
      case "FOREIGN":
        if (!keys.includes("fk")) keys.push("fk");
        break;
      case "UK":
      case "UNIQUE":
        if (!keys.includes("uk")) keys.push("uk");
        break;
      case "NN":
      case "NOTNULL":
      case "NOT_NULL":
        notNull = true;
        break;
      default:
        if (!FLAG_TOKENS.has(upper)) typeParts.push(token);
        break;
    }
  }

  if (references && !keys.includes("fk")) keys.push("fk");

  return {
    name,
    type: typeParts.length ? typeParts.join(" ") : undefined,
    keys,
    notNull: notNull || undefined,
    references,
    note,
  };
}

export function parseTableColumns(raw: unknown): TableColumn[] {
  if (!Array.isArray(raw)) return [];
  const columns: TableColumn[] = [];
  for (const item of raw) {
    const col = parseTableColumnSpec(String(item));
    if (col) columns.push(col);
  }
  return columns;
}

export function findColumnIndex(columns: TableColumn[] | undefined, name: string): number {
  if (!columns) return -1;
  return columns.findIndex((c) => c.name === name);
}

/**
 * Format a structured column as a highlightable line:
 * `customer_id: uuid FK NN -> customers.id // buyer`
 */
export function formatTableColumnLine(col: TableColumn): string {
  const flags: string[] = [];
  for (const key of col.keys) {
    flags.push(key.toUpperCase());
  }
  if (col.notNull) flags.push("NN");

  const rhs: string[] = [];
  if (col.type) rhs.push(col.type);
  rhs.push(...flags);
  if (col.references) {
    rhs.push(`-> ${col.references.table}.${col.references.column}`);
  }

  let line = col.name;
  if (rhs.length) line += `: ${rhs.join(" ")}`;
  if (col.note) line += ` // ${col.note}`;
  return line;
}
