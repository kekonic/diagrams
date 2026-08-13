/**
 * TextMate grammar for KDiagram — used by Shiki (docs) and Monaco (studio).
 * Operators stay in sync with `@kekonic/diagrams-core` EDGE_OPS.
 *
 * Soft-keyword rule: kinds, atoms, and animation cues are position-scoped so
 * node ids like `worker` / group ids like `parallel` stay plain identifiers.
 */

import { BUILTIN_KIND_LIST, EDGE_OPS } from "@kekonic/diagrams-core";

function edgeOpsPatternLocal(): string {
  return EDGE_OPS.map((op) => op.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
}

/** Statement intros — safe-ish globally (parser treats them as soft keywords). */
const keywords = [
  "kdiagram",
  "direction",
  "density",
  "group",
  "boundary",
  "zone",
  "swimlane",
  "layout",
  "edges",
  "style",
  "render",
  "presentation",
  "is",
  "for",
  "edge",
  "svg",
];

/** Only highlighted inside `animation "…" { … }` (and nested `parallel { }`). */
const animationCues = ["dim", "activate", "pulse", "flow", "wait", "loop"];

/** Only highlighted inside `sequence "…" { … }`. */
const sequenceKeywords = [
  "activate",
  "deactivate",
  "create",
  "destroy",
  "note",
  "autonumber",
  "alt",
  "alternate",
  "else",
  "otherwise",
  "opt",
  "optional",
  "loop",
  "par",
  "parallel",
  "and",
  "also",
  "critical",
  "break",
  "section",
  "box",
  "divider",
  "over",
  "left",
  "right",
  "of",
];

/** Escape regex metacharacters in kind ids (none today, but keep safe). */
const kinds = [...BUILTIN_KIND_LIST].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

const atoms = [
  "LR",
  "RL",
  "TD",
  "BT",
  "TB",
  "down",
  "right",
  "true",
  "false",
  "compact",
  "normal",
  "spacious",
  "flat",
  "compound",
  "auto",
  "straight",
  "balanced",
  "basic",
  "metro",
  "rounded",
  "orthogonal",
  "bezier",
  "jumps",
  "smart",
  "gap",
  "gaps",
  "none",
  "tight",
  "wide",
  "on",
  "off",
  "high",
  "low",
  "yes",
  "no",
  "dark",
  "light",
  "pack",
  "stack",
  "flow",
  "row",
  "grid",
  "stretch",
  "start",
  "middle",
  "end",
  "begin",
  "center",
  "target",
  "source",
];

const columnFlags = ["PK", "FK", "UK", "NN", "PRIMARY", "FOREIGN", "UNIQUE", "NOTNULL", "NOT_NULL"];

const sqlTypes = [
  "uuid",
  "text",
  "int",
  "integer",
  "bigint",
  "smallint",
  "bool",
  "boolean",
  "real",
  "float",
  "double",
  "numeric",
  "decimal",
  "money",
  "date",
  "time",
  "timestamp",
  "timestamptz",
  "timetz",
  "json",
  "jsonb",
  "bytea",
  "blob",
  "varchar",
  "char",
  "serial",
  "bigserial",
];

/** Association `--` must not steal CSS custom props (`--icon-color`); keep `-->` intact. */
const operatorsPattern = `(${edgeOpsPatternLocal().replace(/\|--$/, "|--(?![A-Za-z0-9_-])")})`;

const kindAlt = kinds.join("|");
const atomAlt = atoms.join("|");
const cueAlt = animationCues.join("|");
const sequenceAlt = sequenceKeywords.join("|");

export const kdiagramLanguage = {
  name: "kdiagram",
  scopeName: "source.kdiagram",
  aliases: ["fm"],
  patterns: [
    { include: "#comments" },
    { include: "#diagram-header" },
    { include: "#sequence-block" },
    { include: "#animation-block" },
    { include: "#columns-block" },
    { include: "#strings" },
    { include: "#operators" },
    { include: "#properties" },
    { include: "#keywords" },
    { include: "#kinds" },
    { include: "#column-flags" },
    { include: "#atoms" },
    { include: "#direction-atoms" },
    { include: "#numbers" },
    { include: "#colors" },
    { include: "#punctuation" },
  ],
  repository: {
    comments: {
      patterns: [
        { name: "comment.line.double-slash.kdiagram", match: "//.*$" },
        {
          name: "comment.block.kdiagram",
          begin: "/\\*",
          end: "\\*/",
        },
      ],
    },
    /** `diagram|state {` or a quoted title — title string is optional. */
    "diagram-header": {
      name: "meta.diagram.kdiagram",
      begin: "\\b(diagram|state)\\b",
      end: "(?=\\{)|$",
      beginCaptures: {
        0: { name: "keyword.control.kdiagram" },
      },
      patterns: [{ include: "#strings" }],
    },
    /** Full sequence block so fragment/activate words stay scoped. */
    "sequence-block": {
      name: "meta.sequence.kdiagram",
      begin: '(\\bsequence\\b)(?:\\s+("(?:\\\\.|[^"\\\\])*"))?\\s*(\\{)',
      beginCaptures: {
        1: { name: "keyword.control.kdiagram" },
        2: { name: "string.quoted.double.kdiagram" },
        3: { name: "punctuation.kdiagram" },
      },
      end: "\\}",
      endCaptures: {
        0: { name: "punctuation.kdiagram" },
      },
      patterns: [
        { include: "#comments" },
        { include: "#animation-block" },
        { include: "#strings" },
        { include: "#operators" },
        { include: "#sequence-keywords" },
        { include: "#properties" },
        { include: "#keywords" },
        { include: "#kinds" },
        { include: "#atoms" },
        { include: "#numbers" },
        { include: "#punctuation" },
      ],
    },
    "sequence-keywords": {
      name: "keyword.control.kdiagram",
      match: `\\b(${sequenceAlt})\\b`,
    },
    /**
     * Full animation block so cue words stay scoped (node id `flow` / group
     * `parallel` must not light up as keywords in the rest of the diagram).
     */
    "animation-block": {
      name: "meta.animation.kdiagram",
      begin: '(\\banimation\\b)(?:\\s+("(?:\\\\.|[^"\\\\])*"))?\\s*(\\{)',
      beginCaptures: {
        1: { name: "keyword.control.kdiagram" },
        2: { name: "string.quoted.double.kdiagram" },
        3: { name: "punctuation.kdiagram" },
      },
      end: "\\}",
      endCaptures: {
        0: { name: "punctuation.kdiagram" },
      },
      patterns: [
        { include: "#comments" },
        { include: "#strings" },
        { include: "#operators" },
        { include: "#animation-parallel" },
        { include: "#animation-cues" },
        { include: "#keywords" },
        { include: "#numbers" },
        { include: "#punctuation" },
      ],
    },
    "animation-parallel": {
      name: "meta.animation.parallel.kdiagram",
      begin: "(\\bparallel\\b)\\s*(\\{)",
      beginCaptures: {
        1: { name: "keyword.control.kdiagram" },
        2: { name: "punctuation.kdiagram" },
      },
      end: "\\}",
      endCaptures: {
        0: { name: "punctuation.kdiagram" },
      },
      patterns: [
        { include: "#comments" },
        { include: "#strings" },
        { include: "#operators" },
        { include: "#animation-cues" },
        { include: "#keywords" },
        { include: "#numbers" },
        { include: "#punctuation" },
      ],
    },
    "animation-cues": {
      name: "keyword.control.kdiagram",
      match: `\\b(${cueAlt})\\b`,
    },
    "columns-block": {
      name: "meta.columns.kdiagram",
      begin: "\\bcolumns\\b\\s*:?\\s*\\{",
      end: "\\}",
      beginCaptures: {
        0: { name: "keyword.control.kdiagram" },
      },
      patterns: [
        { include: "#comments" },
        {
          name: "meta.column.definition.kdiagram",
          begin: "\\b([A-Za-z_][\\w-]*)\\s*(:)",
          end: "(?=//)|$",
          beginCaptures: {
            1: { name: "variable.other.property.kdiagram" },
            2: { name: "punctuation.separator.key-value.kdiagram" },
          },
          patterns: [
            { include: "#operators" },
            { include: "#column-flags" },
            { include: "#sql-types" },
            { include: "#strings" },
            {
              name: "variable.other.column-ref.kdiagram",
              match: "\\b[A-Za-z_][\\w-]*(?=\\.[A-Za-z_])",
            },
            {
              name: "variable.other.column-ref.kdiagram",
              match: "(?<=\\.)[A-Za-z_][\\w-]*",
            },
          ],
        },
        { include: "#punctuation" },
      ],
    },
    strings: {
      name: "string.quoted.double.kdiagram",
      begin: '"',
      end: '"',
      patterns: [{ name: "constant.character.escape.kdiagram", match: "\\\\." }],
    },
    operators: {
      name: "keyword.operator.kdiagram",
      match: operatorsPattern,
    },
    keywords: {
      name: "keyword.control.kdiagram",
      match: `\\b(${keywords.join("|")})\\b`,
    },
    /** Kinds only in `id: kind` / property value position — not as edge endpoints. */
    kinds: {
      name: "entity.name.type.kdiagram",
      match: `(?<=:)\\s*(${kindAlt})\\b`,
    },
    "column-flags": {
      name: "constant.language.constraint.kdiagram",
      match: `\\b(${columnFlags.join("|")})\\b`,
    },
    "sql-types": {
      name: "storage.type.kdiagram",
      match: `\\b(${sqlTypes.join("|")})\\b`,
    },
    /** Enum-like values after `key:` — not bare ids named `high` / `pack`. */
    atoms: {
      name: "constant.language.kdiagram",
      match: `(?<=:)\\s*(${atomAlt})\\b`,
    },
    /** `direction LR` / `density compact` (no colon). */
    "direction-atoms": {
      name: "constant.language.kdiagram",
      match: `(?<=\\b(?:direction|density)\\s+)(${atomAlt})\\b`,
    },
    properties: {
      name: "variable.other.property.kdiagram",
      match: "(?:--[a-zA-Z_][\\w-]*|\\b[a-zA-Z_][\\w-]*)(?=\\s*:)",
    },
    numbers: {
      name: "constant.numeric.kdiagram",
      // Durations: `200ms`, `1.4s` — unit optional so plain numbers still match.
      match: "\\b\\d+(\\.\\d+)?(?:ms|s)?\\b",
    },
    colors: {
      name: "constant.other.color.kdiagram",
      match: "#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{5}|[0-9a-fA-F]{3}|[0-9a-fA-F])?\\b",
    },
    punctuation: {
      name: "punctuation.kdiagram",
      match: "[{}()\\[\\];,*]",
    },
  },
};

/** Snapshot for tests — must match lexer EDGE_OPS. */
export const KDIAGRAM_EDGE_OPS = [...EDGE_OPS];

export default kdiagramLanguage;
