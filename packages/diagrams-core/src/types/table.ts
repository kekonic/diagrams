import { fkCardinality, type EdgeCardinality } from "./cardinality.ts";

/** Column key roles for ERD-style table nodes. */
export type TableColumnKey = "pk" | "fk" | "uk";

export type TableColumnRef = {
  /** Referenced table / entity node id. */
  table: string;
  /** Referenced column name (usually a PK). First column of a composite FK. */
  column: string;
  /**
   * Full referenced column list when this FK is composite (`-> parent.(a, b)`).
   * Includes `column` as the first entry.
   */
  columns?: string[];
};

export type TableColumn = {
  /** Column / attribute name. */
  name: string;
  /** SQL-ish or conceptual type (e.g. uuid, text, varchar(255)). */
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

export type InferredFkRelationship = {
  cardinality: EdgeCardinality;
  /** True when every FK column in this relationship is part of the child's PK. */
  identifying: boolean;
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
  const arrowRef = trimmed.match(/^(.*?)\s*->\s*(\S.*?)\s*$/);
  if (arrowRef) {
    const parsed = parseColumnRef(arrowRef[2]!);
    if (parsed) {
      trimmed = arrowRef[1]!.trim();
      references = parsed;
    }
  } else {
    const refWord = trimmed.match(/^(.*?)\s+(?:ref|references)\s+(\S.*?)\s*$/i);
    if (refWord) {
      const parsed = parseColumnRef(refWord[2]!);
      if (parsed) {
        trimmed = refWord[1]!.trim();
        references = parsed;
      }
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

const IDENT_RE = "[A-Za-z_][\\w-]*";

/** Parse `customers.id` or composite `order_items.(order_id, line_no)`. */
export function parseColumnRef(raw: string): TableColumnRef | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  const composite = text.match(
    new RegExp(`^(${IDENT_RE})\\.\\(\\s*(${IDENT_RE}(?:\\s*,\\s*${IDENT_RE})+)\\s*\\)$`),
  );
  if (composite) {
    const columns = composite[2]!.split(/\s*,\s*/).filter(Boolean);
    const column = columns[0];
    if (!column || columns.length < 2) return undefined;
    return { table: composite[1]!, column, columns };
  }
  const simple = text.match(new RegExp(`^(${IDENT_RE})\\.(${IDENT_RE})$`));
  if (!simple) return undefined;
  return { table: simple[1]!, column: simple[2]! };
}

export function referencedColumns(ref: TableColumnRef): string[] {
  if (ref.columns && ref.columns.length > 0) return ref.columns;
  return [ref.column];
}

function childPkNames(columns: TableColumn[] | undefined): string[] {
  return (columns ?? []).filter((c) => c.keys.includes("pk")).map((c) => c.name);
}

/**
 * Infer IE cardinality and identifying-ness from the FK columns of one relationship.
 *
 * - Parent end: mandatory (`one`) when every FK column is NOT NULL.
 * - Child end: `zeroOrMany` unless the FK is unique (UK on every FK column, or
 *   the FK columns *are* the child's complete primary key) — then 1:1 / 0..1:0..1.
 * - Identifying when every FK column is part of the child's primary key.
 */
export function inferFkRelationship(
  fkColumns: TableColumn[],
  childColumns?: TableColumn[],
): InferredFkRelationship {
  const notNull = fkColumns.length > 0 && fkColumns.every((c) => Boolean(c.notNull));
  const pkNames = childPkNames(childColumns);
  const fkNames = new Set(fkColumns.map((c) => c.name));
  const uniqueByUk = fkColumns.length > 0 && fkColumns.every((c) => c.keys.includes("uk"));
  const uniqueByPk =
    pkNames.length > 0 &&
    pkNames.every((name) => fkNames.has(name)) &&
    fkColumns.every((c) => pkNames.includes(c.name));
  const unique = uniqueByUk || uniqueByPk;
  const identifying = fkColumns.length > 0 && fkColumns.every((c) => c.keys.includes("pk"));
  return {
    cardinality: fkCardinality(notNull, unique),
    identifying,
  };
}

/**
 * FK columns that belong to the same relationship as `childColName`.
 * Composite FKs (distinct parent columns) are grouped; multi-role FKs to the
 * same parent key stay as a single column.
 */
export function fkColumnsForParent(
  childColumns: TableColumn[] | undefined,
  parentId: string,
  childColName: string | undefined,
): TableColumn[] {
  if (!childColumns || !childColName) return [];
  const siblings = childColumns.filter((c) => c.references?.table === parentId);
  const parentCols = new Set(siblings.flatMap((c) => referencedColumns(c.references!)));
  if (parentCols.size > 1 && siblings.some((c) => c.name === childColName)) return siblings;
  const direct = childColumns.find((c) => c.name === childColName);
  return direct ? [direct] : [];
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
    rhs.push(`-> ${formatColumnRef(col.references)}`);
  }

  let line = col.name;
  if (rhs.length) line += `: ${rhs.join(" ")}`;
  if (col.note) line += ` // ${col.note}`;
  return line;
}

export function formatColumnRef(ref: TableColumnRef): string {
  const cols = referencedColumns(ref);
  if (cols.length > 1) return `${ref.table}.(${cols.join(", ")})`;
  return `${ref.table}.${ref.column}`;
}
