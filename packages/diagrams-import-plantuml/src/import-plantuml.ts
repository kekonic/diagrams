import { STATEMENT_KEYWORDS, type Diagnostic, type SourceRange } from "@kekonic/diagrams-core";

export type PlantUmlImportFidelity = "converted" | "presentation-loss" | "blocked";

export type PlantUmlImportResult = {
  source?: string;
  diagnostics: Diagnostic[];
  fidelity: {
    status: PlantUmlImportFidelity;
    profile: "plantuml-sequence-v1";
  };
};

type OutputKind = "actor" | "participant" | "database" | "queue";
type ArrowOp = "->" | "-->" | "=>" | "-x";
type Placement = "over" | "left" | "right";
type FragmentOperator =
  | "alternate"
  | "optional"
  | "loop"
  | "parallel"
  | "critical"
  | "break"
  | "section";

type Line = {
  text: string;
  range: SourceRange;
};

type Participant = {
  key: string;
  id: string;
  kind: OutputKind;
  label: string;
  create: boolean;
  order: number;
};

type MessageStmt = {
  type: "message";
  from: string;
  to: string;
  op: ArrowOp;
  label?: string;
  activate?: string;
  deactivate?: string;
  range: SourceRange;
};

type Statement =
  | { type: "declaration"; key: string; range: SourceRange }
  | MessageStmt
  | { type: "activate"; key: string; range: SourceRange }
  | { type: "deactivate"; key: string; range: SourceRange }
  | { type: "destroy"; key: string; range: SourceRange }
  | { type: "return"; label?: string; range: SourceRange }
  | { type: "note"; placement: Placement; keys: string[]; text: string; range: SourceRange }
  | { type: "divider"; label?: string; range: SourceRange }
  | {
      type: "fragment";
      operator: FragmentOperator;
      operands: Array<{ label?: string; statements: Statement[] }>;
      range: SourceRange;
    };

type Context = {
  diagnostics: Diagnostic[];
  participants: Map<string, Participant>;
  nextOrder: number;
  nextCall: number;
  title?: string;
  autonumber: boolean;
};

const PROFILE = "plantuml-sequence-v1" as const;
const FRAGMENTS = new Map<string, FragmentOperator>([
  ["alt", "alternate"],
  ["opt", "optional"],
  ["loop", "loop"],
  ["par", "parallel"],
  ["group", "section"],
  ["critical", "critical"],
  ["break", "break"],
]);
const FRAGMENT_CLOSERS = new Set(["alt", "opt", "loop", "par", "group", "critical", "break"]);
const ARROW_TOKENS = [
  "<-->",
  "<->",
  "<<--",
  "-->>",
  "->>",
  "<<-",
  "-->",
  "<--",
  "->x",
  "[->",
  "->]",
  "-x",
  "x-",
  "->",
  "<-",
];
const RESERVED_IDS = new Set<string>([
  ...STATEMENT_KEYWORDS,
  "else",
  "otherwise",
  "and",
  "also",
  "end",
]);

export function importPlantUml(source: string): PlantUmlImportResult {
  const ctx: Context = {
    diagnostics: [],
    participants: new Map(),
    nextOrder: 0,
    nextCall: 1,
    autonumber: false,
  };
  const lines = codeLines(source);
  const diagram = extractDiagram(ctx, lines);
  const statements = diagram ? parseBlock(ctx, diagram.lines, 0, new Set()).statements : [];
  if (
    diagram &&
    statements.length === 0 &&
    !ctx.diagnostics.some((item) => item.severity === "error")
  ) {
    diagnostic(
      ctx,
      "error",
      "PMUML004",
      "PlantUML source has no sequence diagram",
      diagram.anchor,
      "Add a sequence diagram with participants and messages.",
    );
  }
  assignIds(ctx);
  const printable = lower(ctx, statements, []);
  const status = fidelityStatus(ctx.diagnostics);
  return {
    source: status === "blocked" ? undefined : printDiagram(ctx, printable),
    diagnostics: ctx.diagnostics,
    fidelity: { status, profile: PROFILE },
  };
}

function fidelityStatus(diagnostics: readonly Diagnostic[]): PlantUmlImportFidelity {
  if (diagnostics.some((item) => item.severity === "error")) return "blocked";
  if (diagnostics.some((item) => item.severity === "warning")) return "presentation-loss";
  return "converted";
}

function diagnostic(
  ctx: Context,
  severity: Diagnostic["severity"],
  code: string,
  message: string,
  range: SourceRange,
  hint?: string,
): void {
  ctx.diagnostics.push({ severity, code, message, range, hint });
}

function pointRange(): SourceRange {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 1, offset: 0 },
  };
}

function codeLines(source: string): Line[] {
  const lines: Line[] = [];
  let lineNumber = 1;
  let lineStart = 0;
  let code = "";
  let codeStart = 0;
  let mode: "code" | "line" | "block" | "string" = "code";

  const push = (lineEnd: number) => {
    if (code.trim().length > 0) {
      const leading = code.length - code.trimStart().length;
      const text = code.trim();
      const start = codeStart + leading;
      lines.push({
        text,
        range: {
          start: { line: lineNumber, column: start - lineStart + 1, offset: start },
          end: { line: lineNumber, column: lineEnd - lineStart + 1, offset: lineEnd },
        },
      });
    }
    code = "";
  };

  for (let index = 0; index < source.length; index++) {
    const current = source[index]!;
    const next = source[index + 1];
    if (current === "\n") {
      push(index);
      lineNumber++;
      lineStart = index + 1;
      codeStart = index + 1;
      if (mode === "line") mode = "code";
      continue;
    }
    if (mode === "line") continue;
    if (mode === "block") {
      if (current === "'" && next === "/") {
        mode = "code";
        index++;
      }
      continue;
    }
    if (mode === "string") {
      code += current;
      if (current === "\\" && next != null) {
        code += next;
        index++;
        continue;
      }
      if (current === '"') mode = "code";
      continue;
    }
    if (current === "/" && next === "'") {
      mode = "block";
      index++;
      continue;
    }
    if (current === "'") {
      mode = "line";
      continue;
    }
    if (current === '"') mode = "string";
    if (code.length === 0) codeStart = index;
    code += current;
  }
  push(source.length);
  return lines;
}

function extractDiagram(
  ctx: Context,
  lines: readonly Line[],
): { lines: Line[]; anchor: SourceRange } | undefined {
  const starts = lines.filter((line) => /^@start[a-z0-9]+/i.test(line.text));
  if (starts.length > 1) {
    diagnostic(
      ctx,
      "error",
      "PMUML003",
      "Import one PlantUML diagram at a time",
      starts[1]!.range,
      "Split each @start/@end block into its own file.",
    );
    return undefined;
  }
  if (starts.length === 0) {
    const orphanEnd = lines.find((line) => /^@end[a-z0-9]+/i.test(line.text));
    if (orphanEnd) {
      diagnostic(
        ctx,
        "error",
        "PMUML002",
        "Diagram end has no matching @startuml",
        orphanEnd.range,
      );
      return undefined;
    }
    return { lines: [...lines], anchor: lines[0]?.range ?? pointRange() };
  }

  const start = starts[0]!;
  const kind = /^@start([a-z0-9]+)/i.exec(start.text)?.[1]?.toLowerCase() ?? "";
  if (kind !== "uml") {
    diagnostic(
      ctx,
      "error",
      "PMUML002",
      `PlantUML ${kind} diagrams are not a sequence import`,
      start.range,
      "This importer converts sequence diagrams. Leave other PlantUML families in PlantUML.",
    );
    return undefined;
  }
  const startAt = lines.indexOf(start);
  const endAt = lines.findIndex(
    (line, index) => index > startAt && /^@end[a-z0-9]+/i.test(line.text),
  );
  return {
    lines: lines.slice(startAt + 1, endAt === -1 ? undefined : endAt),
    anchor: start.range,
  };
}

type Clause = "else" | "end";

function parseBlock(
  ctx: Context,
  lines: readonly Line[],
  start: number,
  stop: ReadonlySet<Clause>,
): { statements: Statement[]; index: number; clause?: Clause; clauseLabel?: string } {
  const statements: Statement[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index]!;
    const clause = clauseOf(line.text);
    if (clause && stop.has(clause.kind)) {
      return {
        statements,
        index: index + 1,
        clause: clause.kind,
        clauseLabel: clause.label,
      };
    }
    const parsed = parseStatement(ctx, lines, index);
    statements.push(...parsed.statements);
    index = parsed.next;
  }
  return { statements, index };
}

function parseStatement(
  ctx: Context,
  lines: readonly Line[],
  index: number,
): { statements: Statement[]; next: number } {
  const line = lines[index]!;
  const text = line.text.trim();
  const directive = preprocessor(ctx, line, text);
  if (directive) return { statements: [], next: index + 1 };
  const skipped = skipPresentation(ctx, lines, index, text);
  if (skipped != null) return { statements: [], next: skipped };
  if (text.startsWith("==")) {
    const label = text
      .replace(/^=+\s*/, "")
      .replace(/\s*=+$/, "")
      .trim();
    return {
      statements: [{ type: "divider", label: label || undefined, range: line.range }],
      next: index + 1,
    };
  }
  const note = parseNote(ctx, lines, index, text);
  if (note) return note;
  const unsupported = parseUnsupported(ctx, lines, index, text);
  if (unsupported) return unsupported;
  const fragment = FRAGMENTS.get(firstWord(text).toLowerCase());
  if (fragment) return parseFragment(ctx, lines, index, fragment);
  const clause = clauseOf(text);
  if (clause) {
    diagnostic(ctx, "error", "PMUML004", `Unexpected ${clause.kind}`, line.range);
    return { statements: [], next: index + 1 };
  }
  const lifecycle = parseLifecycle(ctx, lines, index, text);
  if (lifecycle) return lifecycle;
  const declaration = parseDeclarationLine(ctx, line, text, index, false);
  if (declaration) return declaration;
  if (isOtherFamily(ctx, line, text)) return { statements: [], next: index + 1 };
  if (isStructuralRelationship(text)) {
    diagnostic(
      ctx,
      "error",
      "PMUML002",
      "Class relationships are not a sequence import",
      line.range,
      "Composition, aggregation, and inheritance arrows belong to a class diagram.",
    );
    return { statements: [], next: index + 1 };
  }
  const message = parseMessage(ctx, line, text);
  if (message === "rejected") return { statements: [], next: index + 1 };
  if (message) return { statements: [message], next: index + 1 };
  diagnostic(
    ctx,
    "error",
    "PMUML004",
    `Unsupported sequence line: ${truncate(text)}`,
    line.range,
    "Remove the construct or keep this diagram in PlantUML.",
  );
  return { statements: [], next: index + 1 };
}

function parseFragment(
  ctx: Context,
  lines: readonly Line[],
  index: number,
  operator: FragmentOperator,
): { statements: Statement[]; next: number } {
  const opener = lines[index]!;
  const keyword = firstWord(opener.text);
  const label = cleanText(ctx, opener, opener.text.trim().slice(keyword.length).trim());
  const operands: Array<{ label?: string; statements: Statement[] }> = [];
  let currentLabel = label || undefined;
  let cursor = index + 1;
  while (cursor <= lines.length) {
    const block = parseBlock(ctx, lines, cursor, new Set(["else", "end"]));
    operands.push({ label: currentLabel, statements: block.statements });
    if (block.clause !== "else") {
      if (block.clause !== "end") {
        diagnostic(
          ctx,
          "error",
          "PMUML005",
          `Unclosed ${keyword} fragment`,
          opener.range,
          "Close the fragment with end.",
        );
      }
      return {
        statements: [{ type: "fragment", operator, operands, range: opener.range }],
        next: block.index,
      };
    }
    if (operator !== "alternate" && operator !== "parallel") {
      diagnostic(
        ctx,
        "error",
        "PMUML004",
        `else is not part of ${keyword}`,
        lines[block.index - 1]?.range ?? opener.range,
      );
    }
    const elseLine = lines[block.index - 1] ?? opener;
    currentLabel = block.clauseLabel ? cleanText(ctx, elseLine, block.clauseLabel) : undefined;
    cursor = block.index;
  }
  return { statements: [], next: lines.length };
}

function parseLifecycle(
  ctx: Context,
  lines: readonly Line[],
  index: number,
  text: string,
): { statements: Statement[]; next: number } | undefined {
  const line = lines[index]!;
  const activate = /^(activate|deactivate)\s+(.+)$/i.exec(text);
  if (activate) {
    const name = readDecoratedName(ctx, line, activate[2] ?? "");
    if (!name) return { statements: [], next: index + 1 };
    register(ctx, name);
    const type = activate[1]!.toLowerCase() === "activate" ? "activate" : "deactivate";
    return { statements: [{ type, key: name, range: line.range }], next: index + 1 };
  }
  const destroyed = /^destroy\s+(.+)$/i.exec(text);
  if (destroyed) {
    const name = readDecoratedName(ctx, line, destroyed[1] ?? "");
    if (!name) return { statements: [], next: index + 1 };
    register(ctx, name);
    return { statements: [{ type: "destroy", key: name, range: line.range }], next: index + 1 };
  }
  const created = /^create\b\s*(.*)$/i.exec(text);
  if (created) {
    const rest = created[1] ?? "";
    const declared = parseDeclarationLine(ctx, line, rest || "participant", index, true);
    if (declared) return declared;
    const name = readDecoratedName(ctx, line, rest);
    if (!name) return { statements: [], next: index + 1 };
    register(ctx, name, { kind: "participant", label: name, create: true });
    return {
      statements: [{ type: "declaration", key: name, range: line.range }],
      next: index + 1,
    };
  }
  const returned = /^return\b\s*:?\s*(.*)$/i.exec(text);
  if (returned) {
    const label = cleanText(ctx, line, returned[1] ?? "");
    return {
      statements: [{ type: "return", label: label || undefined, range: line.range }],
      next: index + 1,
    };
  }
  return undefined;
}

function parseDeclarationLine(
  ctx: Context,
  line: Line,
  text: string,
  index: number,
  create: boolean,
): { statements: Statement[]; next: number } | undefined {
  const match =
    /^(actor|participant|boundary|control|entity|database|collections|queue)\b\s*(.*)$/i.exec(
      text.trim(),
    );
  if (!match) return undefined;
  const word = match[1]!.toLowerCase();
  const parsed = parseDeclaredName(ctx, line, match[2] ?? "");
  if (!parsed) return { statements: [], next: index + 1 };
  const mapped = mapLifeline(ctx, line, word);
  register(ctx, parsed.key, { kind: mapped, label: parsed.label, create });
  return {
    statements: [{ type: "declaration", key: parsed.key, range: line.range }],
    next: index + 1,
  };
}

function mapLifeline(ctx: Context, line: Line, word: string): OutputKind {
  if (word === "actor" || word === "database" || word === "queue") return word;
  if (word === "participant") return "participant";
  diagnostic(
    ctx,
    "warning",
    "PMUML011",
    `PlantUML ${word} lifeline is represented as participant`,
    line.range,
    "The sequence keeps the participant label without the PlantUML lifeline shape.",
  );
  return "participant";
}

function parseDeclaredName(
  ctx: Context,
  line: Line,
  rest: string,
): { key: string; label: string } | undefined {
  let input = rest.trim();
  let decorated = false;
  input = input.replace(/<<[^>\n]*>>/g, () => {
    decorated = true;
    return " ";
  });
  input = input.replace(/#[A-Za-z0-9]+/g, () => {
    decorated = true;
    return " ";
  });
  const ordered = /\border\s+\d+\b/i.test(input);
  input = input.replace(/\border\s+\d+\b/i, " ");
  if (decorated) {
    diagnostic(
      ctx,
      "warning",
      "PMUML008",
      "Participant color or stereotype was ignored",
      line.range,
      "Themes and kinds carry presentation after import.",
    );
  }
  if (ordered) {
    diagnostic(
      ctx,
      "warning",
      "PMUML007",
      "Participant order hint was ignored",
      line.range,
      "Lifeline order follows declaration and first use.",
    );
  }
  const tokens = tokenizeDeclaration(input);
  if (tokens.length === 0) {
    diagnostic(ctx, "error", "PMUML004", "Participant declaration is missing a name", line.range);
    return undefined;
  }
  const asAt = tokens.findIndex((token) => token.toLowerCase() === "as");
  if (asAt >= 0) {
    const alias = tokens[asAt + 1];
    const label = tokens.slice(0, asAt).join(" ");
    if (!alias || !label) {
      diagnostic(ctx, "error", "PMUML004", "Participant alias is incomplete", line.range);
      return undefined;
    }
    return { key: unquote(alias), label: cleanText(ctx, line, unquote(label)) };
  }
  const rawLabel = unquote(tokens.join(" "));
  return { key: rawLabel, label: cleanText(ctx, line, rawLabel) };
}

function tokenizeDeclaration(input: string): string[] {
  const tokens: string[] = [];
  let cursor = input.trim();
  while (cursor.length > 0) {
    if (cursor.startsWith('"')) {
      let value = '"';
      let index = 1;
      while (index < cursor.length) {
        value += cursor[index]!;
        if (cursor[index] === "\\" && index + 1 < cursor.length) {
          value += cursor[index + 1]!;
          index += 2;
          continue;
        }
        if (cursor[index] === '"') {
          index++;
          break;
        }
        index++;
      }
      tokens.push(value);
      cursor = cursor.slice(index).trim();
      continue;
    }
    const word = /^[^\s]+/.exec(cursor);
    if (!word) break;
    tokens.push(word[0]);
    cursor = cursor.slice(word[0].length).trim();
  }
  return tokens;
}

function parseNote(
  ctx: Context,
  lines: readonly Line[],
  index: number,
  text: string,
): { statements: Statement[]; next: number } | undefined {
  if (!/^(note|hnote|rnote)\b/i.test(text)) return undefined;
  const line = lines[index]!;
  if (/^(hnote|rnote)\b/i.test(text)) {
    diagnostic(
      ctx,
      "warning",
      "PMUML007",
      "Note shape was represented as a sequence note",
      line.range,
    );
  }
  let rest = text.replace(/^(note|hnote|rnote)\b/i, "").trim();
  let placement: Placement = "over";
  if (/^left\b/i.test(rest)) {
    placement = "left";
    rest = rest.replace(/^left\b(?:\s+of\b)?/i, "").trim();
  } else if (/^right\b/i.test(rest)) {
    placement = "right";
    rest = rest.replace(/^right\b(?:\s+of\b)?/i, "").trim();
  } else if (/^over\b/i.test(rest)) {
    rest = rest.replace(/^over\b/i, "").trim();
  } else if (/^across\b/i.test(rest)) {
    rest = rest.replace(/^across\b/i, "").trim();
    diagnostic(ctx, "warning", "PMUML007", "Note across was represented as note over", line.range);
  } else {
    diagnostic(ctx, "error", "PMUML004", "Note is missing a placement", line.range);
    return { statements: [], next: index + 1 };
  }
  const names = readNameList(rest);
  if (names.keys.length === 0) {
    diagnostic(ctx, "error", "PMUML004", "Note is missing a participant", line.range);
    return { statements: [], next: index + 1 };
  }
  for (const key of names.keys) register(ctx, key);
  let noteText = "";
  let next = index + 1;
  if (names.rest.trim().startsWith(":")) {
    noteText = cleanText(ctx, line, names.rest.trim().slice(1));
  } else {
    const collected: string[] = [];
    while (next < lines.length && !/^end(?:\s+note)?\s*$/i.test(lines[next]!.text.trim())) {
      collected.push(lines[next]!.text.trim());
      next++;
    }
    if (next < lines.length) next++;
    else {
      diagnostic(
        ctx,
        "error",
        "PMUML005",
        "Unclosed note",
        line.range,
        "Close the note with end note.",
      );
    }
    if (collected.length > 1) {
      diagnostic(ctx, "warning", "PMUML010", "Note line breaks were flattened", line.range);
    }
    noteText = cleanText(ctx, line, collected.join(" "));
  }
  return {
    statements: [{ type: "note", placement, keys: names.keys, text: noteText, range: line.range }],
    next,
  };
}

function parseUnsupported(
  ctx: Context,
  lines: readonly Line[],
  index: number,
  text: string,
): { statements: Statement[]; next: number } | undefined {
  const line = lines[index]!;
  if (/^(?:left to right|right to left|top to bottom|bottom to top)\s+direction\b/i.test(text)) {
    diagnostic(
      ctx,
      "warning",
      "PMUML007",
      "Diagram direction was ignored",
      line.range,
      "Sequence lifelines stay in declaration order.",
    );
    return { statements: [], next: index + 1 };
  }
  if (/^together\b/i.test(text) || /^[{}]+$/.test(text)) {
    diagnostic(ctx, "warning", "PMUML007", "Participant grouping was ignored", line.range);
    return { statements: [], next: index + 1 };
  }
  if (/^(?:\.{3,}|delay\b)/i.test(text)) {
    diagnostic(
      ctx,
      "error",
      "PMUML004",
      "Sequence delays are not imported",
      line.range,
      "Delays change the interaction timing, so this diagram stays blocked.",
    );
    return { statements: [], next: index + 1 };
  }
  if (/^\|+$/.test(text)) {
    diagnostic(ctx, "warning", "PMUML007", "Lifeline spacing was ignored", line.range);
    return { statements: [], next: index + 1 };
  }
  if (/^newpage\b/i.test(text)) {
    diagnostic(
      ctx,
      "error",
      "PMUML004",
      "newpage splits a diagram and is not imported",
      line.range,
    );
    return { statements: [], next: index + 1 };
  }
  if (/^ref\b/i.test(text)) {
    diagnostic(
      ctx,
      "error",
      "PMUML004",
      "Interaction references are not imported",
      line.range,
      "A ref should become a reusable interaction before this diagram can convert.",
    );
    return { statements: [], next: skipConstruct(lines, index, text, "ref") };
  }
  if (/^box\b/i.test(text)) {
    diagnostic(
      ctx,
      "error",
      "PMUML004",
      "Participant groups are not imported",
      line.range,
      "A box should become a sequence boundary before this diagram can convert.",
    );
    return { statements: [], next: skipConstruct(lines, index, text, "box") };
  }
  return undefined;
}

function skipConstruct(lines: readonly Line[], index: number, text: string, word: string): number {
  if (text.includes(":") || new RegExp(`\\bend\\s+${word}\\b`, "i").test(text)) return index + 1;
  let next = index + 1;
  const end = new RegExp(`^end(?:\\s+${word})?\\s*$`, "i");
  while (next < lines.length && !end.test(lines[next]!.text.trim())) next++;
  return next < lines.length ? next + 1 : next;
}

function parseMessage(
  ctx: Context,
  line: Line,
  text: string,
): MessageStmt | "rejected" | undefined {
  const normalized = normalizeMessage(ctx, line, text);
  const found = findArrow(normalized);
  if (!found) return undefined;
  if (found.token === "<->" || found.token === "<-->") {
    diagnostic(
      ctx,
      "error",
      "PMUML004",
      "Bidirectional messages are not represented",
      line.range,
      "Split the exchange into two directed messages, then import again.",
    );
    return "rejected";
  }
  const left = normalized.slice(0, found.index).trim();
  const right = normalized.slice(found.index + found.token.length).trim();
  let activate = false;
  let deactivate = false;
  const colon = right.indexOf(":");
  const label = colon >= 0 ? cleanText(ctx, line, right.slice(colon + 1)) : undefined;
  let head = (colon >= 0 ? right.slice(0, colon) : right).trim();
  head = head
    .replace(/\s*(\+\+|--)\s*$/, (_match, mark: string) => {
      activate = mark === "++";
      deactivate = mark === "--";
      return "";
    })
    .trim();
  if (/^o\s+\S/.test(head)) {
    diagnostic(ctx, "warning", "PMUML008", "Arrowhead style was ignored", line.range);
    head = head.replace(/^o\s+/, "");
  }
  const mapped = mapArrow(found.token);
  const leftName = readBareName(left);
  const rightName = readBareName(head);
  if (!mapped.found && leftName) register(ctx, leftName);
  if (!mapped.lost && rightName) register(ctx, rightName);
  let from = mapped.found ? "*" : leftName;
  let to = mapped.lost ? "*" : rightName;
  if (mapped.reverse) {
    const swap = from;
    from = to;
    to = swap;
  }
  if (!from || !to) {
    diagnostic(ctx, "error", "PMUML004", "Message is missing a participant", line.range);
    return undefined;
  }
  const target = to === "*" ? undefined : to;
  return {
    type: "message",
    from,
    to,
    op: mapped.op,
    label: label || undefined,
    activate: activate ? target : undefined,
    deactivate: deactivate ? target : undefined,
    range: line.range,
  };
}

function normalizeMessage(ctx: Context, line: Line, text: string): string {
  let color = false;
  let stereotype = false;
  const stripped = text
    .replace(/\[[ \t]*#[^\]]+\]/g, () => {
      color = true;
      return "";
    })
    .replace(/<<[^>\n]*>>/g, () => {
      stereotype = true;
      return "";
    });
  if (color || stereotype) {
    diagnostic(ctx, "warning", "PMUML008", "Message color or stereotype was ignored", line.range);
  }
  return stripped;
}

function findArrow(text: string): { index: number; token: string } | undefined {
  let best: { index: number; token: string } | undefined;
  for (let index = 0; index < text.length; index++) {
    for (const token of ARROW_TOKENS) {
      if (!text.startsWith(token, index)) continue;
      if (!best || token.length > best.token.length) best = { index, token };
      break;
    }
    if (best?.index === index) break;
  }
  return best;
}

function mapArrow(token: string): { op: ArrowOp; reverse: boolean; found: boolean; lost: boolean } {
  if (token === "[->") return { op: "->", reverse: false, found: true, lost: false };
  if (token === "->]") return { op: "->", reverse: false, found: false, lost: true };
  if (token === "->x" || token === "-x")
    return { op: "-x", reverse: false, found: false, lost: false };
  if (token === "x-") return { op: "-x", reverse: true, found: false, lost: false };
  if (token === "->>" || token === "-->>")
    return { op: "=>", reverse: false, found: false, lost: false };
  if (token === "<<-" || token === "<<--")
    return { op: "=>", reverse: true, found: false, lost: false };
  if (token === "-->") return { op: "-->", reverse: false, found: false, lost: false };
  if (token === "<--") return { op: "-->", reverse: true, found: false, lost: false };
  if (token === "<-") return { op: "->", reverse: true, found: false, lost: false };
  return { op: "->", reverse: false, found: false, lost: false };
}

function preprocessor(ctx: Context, line: Line, text: string): boolean {
  if (!text.startsWith("!")) return false;
  const match = /^!\$?([A-Za-z_]\w*)/.exec(text);
  const name = match?.[1]?.toLowerCase() ?? "directive";
  if (name === "theme" || name === "pragma") {
    diagnostic(ctx, "warning", "PMUML007", `Ignored PlantUML !${name}`, line.range);
    return true;
  }
  diagnostic(
    ctx,
    "error",
    "PMUML001",
    `Preprocessor directive !${name} is not imported`,
    line.range,
    "Expand includes and macros with PlantUML --preproc, then import that result. Remote includes are not run.",
  );
  return true;
}

function skipPresentation(
  ctx: Context,
  lines: readonly Line[],
  index: number,
  text: string,
): number | undefined {
  const line = lines[index]!;
  const title = /^title\b\s*(.*)$/i.exec(text);
  if (title) {
    const inline = title[1]?.trim() ?? "";
    if (inline && inline !== "{") {
      ctx.title = cleanText(ctx, line, inline);
      return index + 1;
    }
    const collected: string[] = [];
    let next = index + 1;
    while (next < lines.length && !/^end(?:\s+title)?\s*$/i.test(lines[next]!.text.trim())) {
      collected.push(lines[next]!.text.trim());
      next++;
    }
    ctx.title = cleanText(ctx, line, collected.join(" "));
    return next < lines.length ? next + 1 : next;
  }
  const autonumber = /^autonumber\b\s*(.*)$/i.exec(text);
  if (autonumber) {
    const args = autonumber[1]?.trim() ?? "";
    if (/^(stop|resume)\b/i.test(args)) {
      diagnostic(ctx, "error", "PMUML004", "Partial autonumber is not imported", line.range);
      return index + 1;
    }
    ctx.autonumber = true;
    if (args) {
      diagnostic(
        ctx,
        "warning",
        "PMUML009",
        "Autonumber start or increment was ignored",
        line.range,
        "The sequence is numbered from 1.",
      );
    }
    return index + 1;
  }
  const block = /^(legend|header|footer|caption|skinparam)\b\s*(.*)$/i.exec(text);
  if (block) {
    diagnostic(
      ctx,
      "warning",
      "PMUML007",
      `Ignored PlantUML ${block[1]!.toLowerCase()}`,
      line.range,
      "Themes and presentation profiles replace PlantUML styling.",
    );
    return consumePresentationBlock(lines, index, block[1]!, block[2] ?? "");
  }
  if (/^(hide|mainframe|scale|rotate|sprite)\b/i.test(text)) {
    diagnostic(
      ctx,
      "warning",
      "PMUML007",
      `Ignored PlantUML ${firstWord(text).toLowerCase()}`,
      line.range,
    );
    return index + 1;
  }
  return undefined;
}

function consumePresentationBlock(
  lines: readonly Line[],
  index: number,
  word: string,
  rest: string,
): number {
  if (word.toLowerCase() === "skinparam") {
    let depth = countBraces(lines[index]!.text);
    let next = index + 1;
    if (depth === 0) return next;
    while (next < lines.length && depth > 0) {
      depth += countBraces(lines[next]!.text);
      next++;
    }
    return next;
  }
  if (rest.trim() && rest.trim() !== "{") return index + 1;
  let next = index + 1;
  const end = new RegExp(`^end(?:\\s+${word})?\\s*$`, "i");
  while (next < lines.length && !end.test(lines[next]!.text.trim())) next++;
  return next < lines.length ? next + 1 : next;
}

function countBraces(text: string): number {
  return (text.match(/\{/g)?.length ?? 0) - (text.match(/\}/g)?.length ?? 0);
}

function isOtherFamily(ctx: Context, line: Line, text: string): boolean {
  if (/^(class|interface|enum|abstract|annotation|protocol|object)\b/i.test(text)) {
    diagnostic(
      ctx,
      "error",
      "PMUML002",
      "Class diagrams are not a sequence import",
      line.range,
      "This importer converts sequence diagrams.",
    );
    return true;
  }
  if (
    /^(component|package|node|artifact|folder|frame|cloud|usecase|rectangle|card)\b/i.test(text)
  ) {
    diagnostic(
      ctx,
      "error",
      "PMUML002",
      "Component and deployment diagrams are not a sequence import",
      line.range,
      "This importer converts sequence diagrams.",
    );
    return true;
  }
  if (/^state\b|\[\*\]/.test(text)) {
    diagnostic(ctx, "error", "PMUML002", "State diagrams are not a sequence import", line.range);
    return true;
  }
  if (
    /^:(.+)[;]$/.test(text) ||
    /^(start|stop|kill|detach|partition|endif|fork|join)$/i.test(text) ||
    /^if\s*\(/i.test(text)
  ) {
    diagnostic(ctx, "error", "PMUML002", "Activity diagrams are not a sequence import", line.range);
    return true;
  }
  return false;
}

function clauseOf(text: string): { kind: Clause; label?: string } | undefined {
  const elseMatch = /^else\b\s*(.*)$/i.exec(text.trim());
  if (elseMatch) {
    const label = elseMatch[1]?.trim();
    return { kind: "else", label: label || undefined };
  }
  const end = /^end(?:\s+(\w+))?\s*$/i.exec(text.trim());
  if (!end) return undefined;
  const qualifier = end[1]?.toLowerCase();
  if (qualifier && !FRAGMENT_CLOSERS.has(qualifier)) return undefined;
  return { kind: "end" };
}

type Call = { id: number; from: string; to: string };

function lower(ctx: Context, statements: readonly Statement[], stack: Call[]): Statement[] {
  const lowered: Statement[] = [];
  for (const statement of statements) {
    if (statement.type === "return") {
      const call = [...stack].reverse().find((item) => item.from !== "*" && item.to !== "*");
      if (!call) {
        diagnostic(ctx, "error", "PMUML006", "return has no open call", statement.range);
        continue;
      }
      stack.splice(stack.lastIndexOf(call), 1);
      lowered.push({
        type: "message",
        from: call.to,
        to: call.from,
        op: "-->",
        label: statement.label,
        deactivate: call.to,
        range: statement.range,
      });
      continue;
    }
    if (statement.type === "message") {
      lowered.push(statement);
      if (statement.op === "-->") {
        const match = stack.findLastIndex(
          (item) => item.to === statement.from && item.from === statement.to,
        );
        if (match >= 0) stack.splice(match, 1);
      } else if (
        (statement.op === "->" || statement.op === "=>") &&
        statement.from !== "*" &&
        statement.to !== "*"
      ) {
        stack.push({ id: ctx.nextCall++, from: statement.from, to: statement.to });
      }
      continue;
    }
    if (statement.type === "fragment") {
      const opened = stack.map((call) => call.id);
      const closedByOperand: Array<Set<number>> = [];
      const operands = statement.operands.map((operand) => {
        const branch = stack.map((call) => ({ ...call }));
        const statements = lower(ctx, operand.statements, branch);
        const remaining = new Set(branch.map((call) => call.id));
        closedByOperand.push(new Set(opened.filter((id) => !remaining.has(id))));
        return { label: operand.label, statements };
      });
      const uneven = opened.some(
        (id) =>
          closedByOperand.some((closed) => closed.has(id)) &&
          !closedByOperand.every((closed) => closed.has(id)),
      );
      if (uneven) {
        diagnostic(
          ctx,
          "warning",
          "PMUML006",
          "return does not cover every branch",
          statement.range,
          "Activation after the fragment follows calls returned in every branch.",
        );
      }
      for (const id of opened) {
        if (!closedByOperand.every((closed) => closed.has(id))) continue;
        const at = stack.findIndex((call) => call.id === id);
        if (at >= 0) stack.splice(at, 1);
      }
      lowered.push({ ...statement, operands });
      continue;
    }
    lowered.push(statement);
  }
  return lowered;
}

function assignIds(ctx: Context): void {
  const used = new Set<string>();
  const ordered = [...ctx.participants.values()].sort((left, right) => left.order - right.order);
  for (const participant of ordered) {
    let base = /^[A-Za-z_][A-Za-z0-9_-]*$/.test(participant.key)
      ? participant.key
      : slug(participant.key);
    if (RESERVED_IDS.has(base)) base = `${base}_`;
    let id = base || "participant";
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}_${suffix}`;
      suffix++;
    }
    used.add(id);
    participant.id = id;
  }
}

function register(
  ctx: Context,
  key: string,
  spec?: { kind: OutputKind; label: string; create: boolean },
): void {
  const existing = ctx.participants.get(key);
  if (existing) {
    if (spec) {
      existing.kind = spec.kind;
      existing.label = spec.label;
      existing.create = existing.create || spec.create;
    }
    return;
  }
  ctx.participants.set(key, {
    key,
    id: "",
    kind: spec?.kind ?? "participant",
    label: spec?.label ?? key,
    create: spec?.create ?? false,
    order: ctx.nextOrder++,
  });
}

function printDiagram(ctx: Context, statements: readonly Statement[]): string {
  const lines: string[] = [];
  lines.push(ctx.title ? `sequence ${quote(ctx.title)} {` : "sequence {");
  if (ctx.autonumber) lines.push("  autonumber");
  const header = [...ctx.participants.values()]
    .filter((participant) => !participant.create)
    .sort((left, right) => left.order - right.order);
  if (header.length > 0) {
    if (ctx.autonumber) lines.push("");
    for (const participant of header) {
      lines.push(`  ${participant.id}: ${participant.kind} ${quote(participant.label)}`);
    }
    lines.push("");
  }
  lines.push(...printStatements(ctx, statements, "  "));
  if (lines.at(-1) === "") lines.pop();
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

function printStatements(ctx: Context, statements: readonly Statement[], indent: string): string[] {
  const lines: string[] = [];
  for (const statement of statements) {
    if (statement.type === "declaration") {
      const participant = ctx.participants.get(statement.key);
      if (!participant?.create) continue;
      lines.push(
        `${indent}create ${participant.id}: ${participant.kind} ${quote(participant.label)}`,
      );
      continue;
    }
    if (statement.type === "message") {
      lines.push(
        `${indent}${ref(ctx, statement.from)} ${statement.op} ${ref(ctx, statement.to)}${statement.label ? ` ${quote(statement.label)}` : ""}`,
      );
      if (statement.activate) lines.push(`${indent}activate ${ref(ctx, statement.activate)}`);
      if (statement.deactivate) lines.push(`${indent}deactivate ${ref(ctx, statement.deactivate)}`);
      continue;
    }
    if (
      statement.type === "activate" ||
      statement.type === "deactivate" ||
      statement.type === "destroy"
    ) {
      lines.push(`${indent}${statement.type} ${ref(ctx, statement.key)}`);
      continue;
    }
    if (statement.type === "note") {
      const placement = statement.placement === "over" ? "over" : `${statement.placement} of`;
      lines.push(
        `${indent}note ${placement} ${statement.keys.map((key) => ref(ctx, key)).join(", ")} ${quote(statement.text)}`,
      );
      continue;
    }
    if (statement.type === "divider") {
      lines.push(
        statement.label ? `${indent}divider ${quote(statement.label)}` : `${indent}divider`,
      );
      continue;
    }
    if (statement.type !== "fragment") {
      throw new Error(`Unexpected ${statement.type} while printing imported sequence`);
    }
    lines.push(...printFragment(ctx, statement, indent));
  }
  return lines;
}

function printFragment(
  ctx: Context,
  statement: Extract<Statement, { type: "fragment" }>,
  indent: string,
): string[] {
  const lines: string[] = [];
  const joiner = statement.operator === "parallel" ? "and" : "else";
  statement.operands.forEach((operand, index) => {
    const keyword = index === 0 ? statement.operator : joiner;
    const label = operand.label ? ` ${quote(flattenPlain(operand.label))}` : "";
    if (index === 0) lines.push(`${indent}${keyword}${label} {`);
    else {
      lines[lines.length - 1] = `${lines.at(-1)} ${keyword}${label} {`;
    }
    lines.push(...printStatements(ctx, operand.statements, `${indent}  `));
    lines.push(`${indent}}`);
  });
  return lines;
}

function ref(ctx: Context, key: string): string {
  if (key === "*") return "*";
  return ctx.participants.get(key)?.id ?? slug(key);
}

function readDecoratedName(ctx: Context, line: Line, text: string): string | undefined {
  const cleaned = text
    .replace(/#[A-Za-z0-9]+/g, "")
    .replace(/<<[^>\n]*>>/g, "")
    .trim();
  if (cleaned !== text.trim()) {
    diagnostic(
      ctx,
      "warning",
      "PMUML008",
      "Participant color or stereotype was ignored",
      line.range,
    );
  }
  return readBareName(cleaned);
}

function readBareName(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('"')) {
    const token = tokenizeDeclaration(trimmed)[0];
    return token ? unquote(token) : undefined;
  }
  const match = /^[A-Za-z_][\w.-]*/.exec(trimmed);
  return match?.[0];
}

function readNameList(text: string): { keys: string[]; rest: string } {
  const keys: string[] = [];
  let rest = text.trim();
  while (rest.length > 0 && !rest.startsWith(":")) {
    if (rest.startsWith('"')) {
      const token = tokenizeDeclaration(rest)[0];
      if (!token) break;
      keys.push(unquote(token));
      rest = rest.slice(token.length).trim().replace(/^,/, "").trim();
      continue;
    }
    const match = /^[A-Za-z_][\w.-]*/.exec(rest);
    if (!match) break;
    keys.push(match[0]);
    rest = rest.slice(match[0].length).trim().replace(/^,/, "").trim();
  }
  return { keys, rest };
}

function cleanText(ctx: Context, line: Line, text: string): string {
  const hadBreak = /\\n/.test(text);
  const flattened = text.replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
  const withoutMarkup = stripCreole(flattened).replace(/\s+/g, " ").trim();
  if (hadBreak || withoutMarkup !== flattened) {
    diagnostic(
      ctx,
      "warning",
      "PMUML010",
      "Inline markup or line breaks were flattened",
      line.range,
    );
  }
  return withoutMarkup;
}

function stripCreole(text: string): string {
  return text
    .replace(/\[\[([^\]\s]+)(?:[ \t]+([^\]]+))?\]\]/g, (_match, url: string, label?: string) =>
      (label ?? url).trim(),
    )
    .replace(/<\/?(?:b|i|u|s|code|del|strike|w)>/gi, "")
    .replace(/<\/?(?:color|back|size)(?::[^>]+)?>/gi, "")
    .replace(/<(?:color:[^>]+|#[A-Fa-f0-9]{3,8}|U\+[A-Fa-f0-9]+)>/gi, "")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/__([^_]*)__/g, "$1")
    .replace(/~~([^~]*)~~/g, "$1")
    .replace(/\/\/([^/]*)\/\//g, "$1")
    .replace(/""([^"]*)""/g, "$1");
}

function isStructuralRelationship(text: string): boolean {
  const head = text.split(":")[0] ?? text;
  return (
    /(?:^|\s)\*\s*[-.]+/.test(head) ||
    /(?:^|\s)o\s*[-.]+(?:>|\|)/.test(head) ||
    /<\||\|>/.test(head) ||
    /(?:^|\s)<\.{2}/.test(head) ||
    /(?:^|\s)\.{2}>/.test(head)
  );
}

function flattenPlain(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function unquote(token: string): string {
  if (token.startsWith('"') && token.endsWith('"')) {
    return token.slice(1, -1).replace(/\\(["\\])/g, "$1");
  }
  return token;
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function slug(value: string): string {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  const prefixed = /^[0-9]/.test(cleaned) ? `p_${cleaned}` : cleaned;
  return prefixed || "participant";
}

function firstWord(text: string): string {
  return /^[^\s]+/.exec(text.trim())?.[0] ?? "";
}

function truncate(text: string): string {
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
