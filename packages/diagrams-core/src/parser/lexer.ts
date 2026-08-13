import type { Diagnostic, SourceRange } from "../types/geometry.ts";
import { EDGE_OPS } from "./edge-ops.ts";

export type TokenType =
  | "identifier"
  | "string"
  | "number"
  | "lbrace"
  | "rbrace"
  | "lbracket"
  | "rbracket"
  | "lparen"
  | "rparen"
  | "colon"
  | "comma"
  | "dot"
  | "star"
  | "edgeOp"
  | "comment"
  | "newline"
  | "eof";

export type Token = {
  type: TokenType;
  value: string;
  range: SourceRange;
};

export type { EdgeOperator } from "./edge-ops.ts";
export { EDGE_OPS, edgeOpsPattern } from "./edge-ops.ts";

/** Soft keywords — statement intros; lexer emits them as identifiers. */
export const STATEMENT_KEYWORDS = new Set([
  "diagram",
  "state",
  "sequence",
  "kdiagram",
  "group",
  "boundary",
  "zone",
  "swimlane",
  "direction",
  "density",
  "layout",
  "edges",
  "render",
  "presentation",
  "animation",
  "style",
  "is",
  "for",
  "edge",
  "svg",
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
]);

export function tokenize(source: string, diagnostics: Diagnostic[] = []): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let column = 1;

  const makeRange = (start: number, end: number): SourceRange => {
    const startLine = source.slice(0, start).split("\n").length;
    const startCol = start - (source.lastIndexOf("\n", start - 1) + 1) + 1;
    const endLine = source.slice(0, end).split("\n").length;
    const endCol = end - (source.lastIndexOf("\n", end - 1) + 1) + 1;
    return {
      start: { line: startLine, column: startCol, offset: start },
      end: { line: endLine, column: endCol, offset: end },
    };
  };

  while (i < source.length) {
    const start = i;

    if (source[i] === "\n") {
      tokens.push({ type: "newline", value: "\n", range: makeRange(start, ++i) });
      line++;
      column = 1;
      continue;
    }

    // Whitespace and property separators (`;` is explicit trivia).
    if (source[i] === " " || source[i] === "\t" || source[i] === "\r" || source[i] === ";") {
      i++;
      column++;
      continue;
    }

    if (source.slice(i, i + 2) === "//") {
      i += 2;
      const commentStart = i;
      while (i < source.length && source[i] !== "\n") i++;
      tokens.push({
        type: "comment",
        value: source.slice(commentStart, i).trim(),
        range: makeRange(start, i),
      });
      continue;
    }

    if (source.slice(i, i + 2) === "/*") {
      i += 2;
      while (i < source.length && source.slice(i, i + 2) !== "*/") i++;
      if (i < source.length) i += 2;
      continue;
    }

    if (source[i] === "[") {
      tokens.push({ type: "lbracket", value: "[", range: makeRange(start, ++i) });
      column++;
      continue;
    }
    if (source[i] === "]") {
      tokens.push({ type: "rbracket", value: "]", range: makeRange(start, ++i) });
      column++;
      continue;
    }
    if (source[i] === "(") {
      tokens.push({ type: "lparen", value: "(", range: makeRange(start, ++i) });
      column++;
      continue;
    }
    if (source[i] === ")") {
      tokens.push({ type: "rparen", value: ")", range: makeRange(start, ++i) });
      column++;
      continue;
    }

    if (source[i] === "{") {
      tokens.push({ type: "lbrace", value: "{", range: makeRange(start, ++i) });
      column++;
      continue;
    }
    if (source[i] === "}") {
      tokens.push({ type: "rbrace", value: "}", range: makeRange(start, ++i) });
      column++;
      continue;
    }
    if (source[i] === ":") {
      tokens.push({ type: "colon", value: ":", range: makeRange(start, ++i) });
      column++;
      continue;
    }
    if (source[i] === ",") {
      // Property / list separator — keep as token (parser already skips commas in props).
      tokens.push({ type: "comma", value: ",", range: makeRange(start, ++i) });
      column++;
      continue;
    }
    if (source[i] === "*") {
      tokens.push({ type: "star", value: "*", range: makeRange(start, ++i) });
      column++;
      continue;
    }

    // CSS hex colors (#rgb, #rrggbb, #rgba, #rrggbbaa).
    if (source[i] === "#") {
      let j = i + 1;
      while (j < source.length && /[0-9a-fA-F]/.test(source[j]!)) j++;
      const hexLen = j - i - 1;
      if (hexLen === 3 || hexLen === 4 || hexLen === 6 || hexLen === 8) {
        tokens.push({ type: "identifier", value: source.slice(i, j), range: makeRange(start, j) });
        column += j - i;
        i = j;
        continue;
      }
      diagnostics.push({
        severity: "error",
        code: "FM006",
        message: `Unexpected character "#"`,
        range: makeRange(start, start + 1),
        hint: "Use a valid hex color (#rgb, #rrggbb, #rgba, or #rrggbbaa)",
      });
      i++;
      column++;
      continue;
    }

    // Edge ops before '.' so "..>" is not split. Association `--` must not steal `--icon-color`.
    let matchedEdge = false;
    for (const op of EDGE_OPS) {
      if (source.slice(i, i + op.length) !== op) continue;
      if (op === "--") {
        const next = source[i + 2];
        if (next && /[A-Za-z0-9_-]/.test(next)) continue;
      }
      tokens.push({ type: "edgeOp", value: op, range: makeRange(start, i + op.length) });
      i += op.length;
      column += op.length;
      matchedEdge = true;
      break;
    }
    if (matchedEdge) continue;

    if (source[i] === ".") {
      tokens.push({ type: "dot", value: ".", range: makeRange(start, ++i) });
      column++;
      continue;
    }

    if (source[i] === '"') {
      i++;
      let value = "";
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\" && i + 1 < source.length) {
          value += source[++i];
        } else {
          value += source[i];
        }
        i++;
      }
      if (i >= source.length || source[i] !== '"') {
        diagnostics.push({
          severity: "error",
          code: "FM007",
          message: "Unclosed string literal",
          range: makeRange(start, i),
        });
      } else {
        i++;
      }
      tokens.push({ type: "string", value, range: makeRange(start, i) });
      continue;
    }

    if (/[0-9]/.test(source[i]!)) {
      let value = "";
      while (i < source.length && /[0-9]/.test(source[i]!)) value += source[i++];
      if (source[i] === "." && /[0-9]/.test(source[i + 1] ?? "")) {
        value += source[i++];
        while (i < source.length && /[0-9]/.test(source[i]!)) value += source[i++];
      }
      tokens.push({ type: "number", value, range: makeRange(start, i) });
      continue;
    }

    // Identifiers: [a-zA-Z_][a-zA-Z0-9_-]* or CSS custom props --name
    if (source[i] === "-" && source[i + 1] === "-" && /[a-zA-Z_]/.test(source[i + 2] ?? "")) {
      let value = "--";
      i += 2;
      while (i < source.length && /[a-zA-Z0-9_-]/.test(source[i]!)) value += source[i++];
      tokens.push({ type: "identifier", value, range: makeRange(start, i) });
      continue;
    }

    if (/[a-zA-Z_]/.test(source[i]!)) {
      let value = "";
      while (i < source.length && /[a-zA-Z0-9_-]/.test(source[i]!)) value += source[i++];
      tokens.push({ type: "identifier", value, range: makeRange(start, i) });
      continue;
    }

    diagnostics.push({
      severity: "error",
      code: "FM006",
      message: `Unexpected character "${source[i]}"`,
      range: makeRange(start, start + 1),
    });
    i++;
    column++;
  }

  tokens.push({
    type: "eof",
    value: "",
    range: makeRange(source.length, source.length),
  });
  return tokens;
}
