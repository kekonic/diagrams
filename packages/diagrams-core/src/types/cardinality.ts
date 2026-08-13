/**
 * Relationship endpoint multiplicity for ERD edges.
 * Drawn as crow's-foot / IE-style markers instead of plain arrowheads.
 */
export type Cardinality = "one" | "zeroOrOne" | "oneOrMany" | "zeroOrMany";

export type EdgeCardinality = {
  /** Multiplicity at the source (from) end. */
  from: Cardinality;
  /** Multiplicity at the target (to) end. */
  to: Cardinality;
};

const ALIASES: Record<string, Cardinality> = {
  "1": "one",
  one: "one",
  exactlyone: "one",
  "0..1": "zeroOrOne",
  "0:1": "zeroOrOne",
  "01": "zeroOrOne",
  zeroorone: "zeroOrOne",
  optional: "zeroOrOne",
  "1..n": "oneOrMany",
  "1..*": "oneOrMany",
  "1:n": "oneOrMany",
  "1:*": "oneOrMany",
  n: "oneOrMany",
  many: "oneOrMany",
  "+": "oneOrMany",
  oneormany: "oneOrMany",
  "0..n": "zeroOrMany",
  "0..*": "zeroOrMany",
  "0:n": "zeroOrMany",
  "0:*": "zeroOrMany",
  "*": "zeroOrMany",
  zeroormany: "zeroOrMany",
};

function normalizeToken(raw: string): Cardinality | undefined {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "");
  return ALIASES[key];
}

/**
 * Parse cardinality from a property or label.
 *
 * Forms:
 * - `"1:N"` / `"1:0..N"` / `"0..1:N"` (from:to)
 * - Mermaid-ish `"||--o{"` / `"}o--||"`
 * - Single side `"N"` (applied to target; source defaults to `one`)
 */
export function parseCardinality(raw: unknown): EdgeCardinality | undefined {
  if (raw == null || raw === "") return undefined;
  if (typeof raw !== "string" && typeof raw !== "number" && typeof raw !== "boolean") {
    return undefined;
  }
  const text = String(raw).trim();
  if (!text) return undefined;

  const mermaid = parseMermaidCardinality(text);
  if (mermaid) return mermaid;

  const parts = text
    .split(/[:|]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const from = normalizeToken(parts[0]!);
    const to = normalizeToken(parts[1]!);
    if (from && to) return { from, to };
  }

  const single = normalizeToken(text);
  if (single) return { from: "one", to: single };

  return undefined;
}

/**
 * True when a label only encodes cardinality (crow's-foot already conveys it).
 * Shared by finalize (label placement) and SVG (hide duplicate text).
 */
export function isPureCardinalityLabel(label: string | undefined): boolean {
  if (!label) return true;
  const t = label.trim();
  if (!t) return true;
  if (parseMermaidCardinality(t)) return true;
  if (/^(?:1|0\.\.1|1\.\.N|0\.\.N|N|\*):\s*(?:1|0\.\.1|1\.\.N|0\.\.N|N|\*)$/i.test(t)) {
    return true;
  }
  if (/^(?:\d+\.\.[Nn*]|\d+:[Nn*]|\*|[Nn]|0\.\.[Nn*])$/i.test(t)) return true;
  // Parsed as cardinality and contains no alphabetic words (aside from N).
  const parsed = parseCardinality(t);
  if (!parsed) return false;
  return !/[a-z]/i.test(t.replace(/n/gi, ""));
}

export function cardinalityLabel(c: EdgeCardinality): string {
  return `${formatSide(c.from)}:${formatSide(c.to)}`;
}

function parseMermaidCardinality(text: string): EdgeCardinality | undefined {
  const t = text.replace(/\s+/g, "");
  const match = t.match(/^([|}{o]+)--([|}{o]+)$/);
  if (!match) return undefined;
  const from = mermaidEnd(match[1]!);
  const to = mermaidEnd(match[2]!);
  if (!from || !to) return undefined;
  return { from, to };
}

function mermaidEnd(token: string): Cardinality | undefined {
  if (token === "}o" || token === "o{") return "zeroOrMany";
  if (token === "}|" || token === "|{") return "oneOrMany";
  if (token === "||") return "one";
  if (token === "o|" || token === "|o") return "zeroOrOne";
  if (token === "|") return "one";
  if (token === "o") return "zeroOrOne";
  return undefined;
}

function formatSide(c: Cardinality): string {
  switch (c) {
    case "one":
      return "1";
    case "zeroOrOne":
      return "0..1";
    case "oneOrMany":
      return "1..N";
    case "zeroOrMany":
      return "0..N";
  }
}

/** Default IE cardinality for a FK from parent → child. */
export function fkCardinality(fkNotNull: boolean | undefined): EdgeCardinality {
  // Nullability lives on the parent end: optional parent participation when FK is nullable.
  return {
    from: fkNotNull ? "one" : "zeroOrOne",
    to: "zeroOrMany",
  };
}
