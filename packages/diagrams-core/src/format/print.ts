import { parse } from "../parser/parser.ts";
import type {
  DiagramAst,
  KDiagramAst,
  GroupAst,
  SequenceAst,
  SequenceStatementAst,
  StatementAst,
  TopLevelNode,
} from "../parser/ast.ts";
import { formatTableColumnLine, parseTableColumnSpec } from "../types/table.ts";

const INDENT = "  ";

export function formatSource(source: string): string {
  const ast = parse(source);
  if (ast.diagnostics.some((d) => d.severity === "error")) {
    return source.trimEnd() + "\n";
  }
  return printDocument(ast);
}

function printDocument(ast: KDiagramAst): string {
  const parts: string[] = [];
  if (ast.version != null) parts.push(`kdiagram ${ast.version}`);
  parts.push(...ast.body.map(printTopLevel));
  return parts.join("\n\n") + "\n";
}

function printTopLevel(node: TopLevelNode): string {
  if (node.type === "Sequence") return printSequence(node);
  return printDiagram(node);
}

function printDiagram(diagram: DiagramAst): string {
  const keyword = diagram.diagramKind === "state" ? "state" : "diagram";
  const head = diagram.name != null ? `${keyword} "${diagram.name}" {` : `${keyword} {`;
  const lines: string[] = [head];
  // Hoist policy as a unit, but retain its authored order: direction/density shorthand and layout
  // blocks can target the same field, so sorting those statements could change which value wins.
  const policy = diagram.statements.filter(isDiagramPolicyStatement);
  const content = diagram.statements.filter((statement) => !isDiagramPolicyStatement(statement));

  for (const statement of policy) printStatement(statement, 1, lines);
  if (policy.length > 0 && content.length > 0) lines.push("");
  let previousContent: StatementAst | undefined;
  for (const statement of content) {
    const adjacentInSource =
      previousContent != null &&
      diagram.statements.indexOf(statement) === diagram.statements.indexOf(previousContent) + 1;
    if (previousContent && adjacentInSource && hasBlankLineBetween(previousContent, statement)) {
      lines.push("");
    }
    printStatement(statement, 1, lines);
    previousContent = statement;
  }
  lines.push("}");
  return lines.join("\n");
}

function isDiagramPolicyStatement(statement: StatementAst): boolean {
  return diagramPolicyRank(statement) < Number.POSITIVE_INFINITY;
}

function diagramPolicyRank(statement: StatementAst): number {
  if (statement.type === "Directive" && statement.name === "direction") return 0;
  if (statement.type === "Directive" && statement.name === "density") return 1;
  if (statement.type === "LayoutBlock") return 2;
  if (statement.type === "EdgePolicyBlock") return 3;
  if (statement.type === "RenderBlock") return 4;
  if (statement.type === "PresentationBlock") return 5;
  return Number.POSITIVE_INFINITY;
}

function printSequence(seq: SequenceAst): string {
  const head = seq.name != null ? `sequence "${seq.name}" {` : "sequence {";
  const lines: string[] = [head];
  printSeparated(seq.statements, lines, (stmt) => printSequenceStatement(stmt, 1, lines));
  lines.push("}");
  return lines.join("\n");
}

function printSequenceStatement(stmt: SequenceStatementAst, depth: number, lines: string[]): void {
  const pad = INDENT.repeat(depth);
  switch (stmt.type) {
    case "SequenceActivate":
      lines.push(`${pad}activate ${stmt.participantId}`);
      break;
    case "SequenceDeactivate":
      lines.push(`${pad}deactivate ${stmt.participantId}`);
      break;
    case "SequenceCreate": {
      const n = stmt.node;
      const isSuffix = n.styleRefs.map((s) => ` is ${s}`).join("");
      const head = `${pad}create ${n.id}: ${n.kind}${n.label ? ` "${n.label}"` : ""}${isSuffix}`;
      printPropsBlock(head, n.properties, depth, lines);
      break;
    }
    case "SequenceDestroy":
      lines.push(`${pad}destroy ${stmt.participantId}`);
      break;
    case "SequenceNote": {
      const ids = stmt.participantIds.join(", ");
      const place =
        stmt.placement === "over"
          ? `over ${ids}`
          : stmt.placement === "left"
            ? `left of ${ids}`
            : `right of ${ids}`;
      lines.push(`${pad}note ${place} "${stmt.text}"`);
      break;
    }
    case "SequenceDivider":
      lines.push(stmt.label ? `${pad}divider "${stmt.label}"` : `${pad}divider`);
      break;
    case "SequenceAutonumber":
      lines.push(`${pad}autonumber`);
      break;
    case "SequenceFragment": {
      const label = stmt.label ? ` "${stmt.label}"` : "";
      for (let i = 0; i < stmt.operands.length; i++) {
        const op = stmt.operands[i]!;
        const keyword = i === 0 ? stmt.operator : stmt.operator === "parallel" ? "and" : "else";
        const opLabel = i === 0 ? label : op.label ? ` "${op.label}"` : "";
        const styleSuffix = op.styleRefs.map((s) => ` is ${s}`).join("");
        lines.push(`${pad}${keyword}${opLabel}${styleSuffix} {`);
        printSeparated(op.statements, lines, (inner) =>
          printSequenceStatement(inner, depth + 1, lines),
        );
        lines.push(`${pad}}`);
      }
      break;
    }
    default:
      printStatement(stmt as StatementAst, depth, lines);
      break;
  }
}

function printStatement(stmt: StatementAst, depth: number, lines: string[]): void {
  const pad = INDENT.repeat(depth);
  switch (stmt.type) {
    case "Directive":
      lines.push(`${pad}${printDirective(stmt)}`);
      break;
    case "Node": {
      const isSuffix = stmt.styleRefs.map((s) => ` is ${s}`).join("");
      const head = `${pad}${stmt.id}: ${stmt.kind}${stmt.label ? ` "${stmt.label}"` : ""}${isSuffix}`;
      printPropsBlock(head, stmt.properties, depth, lines);
      break;
    }
    case "Edge": {
      const from = stmt.fromColumn ? `${stmt.from}.${stmt.fromColumn}` : stmt.from;
      const to = stmt.toColumn ? `${stmt.to}.${stmt.toColumn}` : stmt.to;
      const label = stmt.label ? ` "${stmt.label}"` : "";
      const isSuffix = stmt.styleRefs.map((s) => ` is ${s}`).join("");
      const head = `${pad}${from} ${stmt.op} ${to}${label}`;
      printPropsBlock(head, stmt.properties, depth, lines, isSuffix);
      break;
    }
    case "Group":
      printGroup(stmt, depth, lines);
      break;
    case "Style": {
      const forTarget =
        stmt.target === "edge" ? " for edge" : stmt.target === "fragment" ? " for fragment" : "";
      printPropertyBlock(`${pad}style ${stmt.name}${forTarget}`, stmt.properties, depth, lines);
      break;
    }
    case "StyleRef":
      lines.push(`${pad}${stmt.targetIds.join(", ")} is ${stmt.styleName}`);
      break;
    case "GroupMember":
      lines.push(`${pad}${stmt.nodeIds.join(", ")}`);
      break;
    case "LayoutBlock":
      printPropertyBlock(`${pad}layout`, stmt.properties, depth, lines);
      break;
    case "EdgePolicyBlock":
      printPropertyBlock(`${pad}edges`, stmt.properties, depth, lines);
      break;
    case "RenderBlock":
      printPropertyBlock(`${pad}render`, stmt.properties, depth, lines);
      break;
    case "PresentationBlock":
      printPropertyBlock(`${pad}presentation`, stmt.properties, depth, lines);
      break;
    case "AnimationBlock": {
      lines.push(`${pad}animation "${stmt.name}" {`);
      printSeparated(stmt.cues, lines, (cue) => {
        for (const line of formatAnimationCueLines(cue)) {
          lines.push(line ? `${pad}${INDENT}${line}` : "");
        }
      });
      lines.push(`${pad}}`);
      break;
    }
  }
}

function printDirective(stmt: Extract<StatementAst, { type: "Directive" }>): string {
  const value = Array.isArray(stmt.value) ? stmt.value.join(", ") : (stmt.value ?? "");
  // Top-level layout shorthand is intentionally whitespace-delimited. A colon makes the parser
  // treat `direction` or `density` as a node id; group layout hints retain property syntax.
  return stmt.name === "direction" || stmt.name === "density"
    ? `${stmt.name} ${value}`
    : `${stmt.name}: ${value}`;
}

function formatAnimationCueLines(cue: import("../parser/ast.ts").AnimationCueAst): string[] {
  if (cue.type === "parallel") {
    const lines = ["parallel {"];
    let previous: (typeof cue.cues)[number] | undefined;
    for (const child of cue.cues) {
      if (previous && hasBlankLineBetween(previous, child)) lines.push("");
      for (const line of formatAnimationCueLines(child)) {
        lines.push(line ? `${INDENT}${line}` : "");
      }
      previous = child;
    }
    lines.push("}");
    return lines;
  }
  return [formatAnimationCue(cue)];
}

function formatAnimationCue(cue: import("../parser/ast.ts").AnimationCueAst): string {
  switch (cue.type) {
    case "loop":
      return "loop";
    case "wait":
      return `wait ${formatDuration(cue.durationMs)}`;
    case "dim":
    case "activate":
      return `${cue.type} ${cue.targets.map(formatAnimationTarget).join(", ")}`;
    case "pulse": {
      const dur = cue.durationMs != null ? ` for ${formatDuration(cue.durationMs)}` : "";
      return `pulse ${cue.targets.map(formatAnimationTarget).join(", ")}${dur}`;
    }
    case "flow": {
      const dur = cue.durationMs != null ? ` for ${formatDuration(cue.durationMs)}` : "";
      return `flow ${cue.path.join(" -> ")}${dur}`;
    }
    case "parallel":
      return "parallel { … }";
  }
}

function formatAnimationTarget(t: import("../parser/ast.ts").AnimationTargetAst): string {
  if (t.type === "all") return "*";
  if (t.type === "node") return t.id;
  return `${t.from} -> ${t.to}`;
}

function formatDuration(ms: number): string {
  if (ms >= 1000 && ms % 100 === 0) {
    const s = ms / 1000;
    return `${s}s`;
  }
  return `${ms}ms`;
}

function printPropsBlock(
  head: string,
  properties: Record<string, string | number | boolean | string[]>,
  depth: number,
  lines: string[],
  tail = "",
): void {
  const pad = INDENT.repeat(depth);
  const entries = Object.entries(properties);
  if (entries.length === 0) {
    lines.push(`${head}${tail}`);
    return;
  }
  if (entries.length === 1 && entries[0]![0] !== "columns") {
    const [key, value] = entries[0]!;
    lines.push(`${head} { ${key}: ${formatValue(value)} }${tail}`);
    return;
  }
  lines.push(`${head} {`);
  for (const [k, v] of entries) {
    if (k === "columns" && Array.isArray(v)) {
      lines.push(`${pad}${INDENT}columns {`);
      for (const raw of v) {
        const col = parseTableColumnSpec(String(raw));
        const line = col ? formatTableColumnLine(col) : String(raw);
        lines.push(`${pad}${INDENT}${INDENT}${line}`);
      }
      lines.push(`${pad}${INDENT}}`);
      continue;
    }
    lines.push(`${pad}${INDENT}${k}: ${formatValue(v)}`);
  }
  lines.push(`${pad}}${tail}`);
}

function printGroup(group: GroupAst, depth: number, lines: string[]): void {
  const pad = INDENT.repeat(depth);
  const id = group.id ? `${group.id} ` : "";
  const label = group.label != null ? `"${group.label}" ` : "";
  lines.push(`${pad}${group.groupKind} ${id}${label}{`);
  printSeparated(group.statements, lines, (stmt) => printStatement(stmt, depth + 1, lines));
  lines.push(`${pad}}`);
}

function printPropertyBlock(
  head: string,
  properties: Record<string, string | number | boolean | string[]>,
  depth: number,
  lines: string[],
): void {
  const entries = Object.entries(properties);
  if (entries.length === 0) {
    lines.push(`${head} {}`);
    return;
  }
  if (entries.length === 1) {
    const [key, value] = entries[0]!;
    lines.push(`${head} { ${key}: ${formatValue(value)} }`);
    return;
  }

  const pad = INDENT.repeat(depth);
  lines.push(`${head} {`);
  for (const [key, value] of entries) {
    lines.push(`${pad}${INDENT}${key}: ${formatValue(value)}`);
  }
  lines.push(`${pad}}`);
}

function printSeparated<T extends { range: { start: { line: number }; end: { line: number } } }>(
  items: T[],
  lines: string[],
  print: (item: T) => void,
): void {
  let previous: T | undefined;
  for (const item of items) {
    if (previous && hasBlankLineBetween(previous, item)) {
      lines.push("");
    }
    print(item);
    previous = item;
  }
}

function hasBlankLineBetween(
  previous: { range: { end: { line: number } } },
  next: { range: { start: { line: number } } },
): boolean {
  return next.range.start.line > previous.range.end.line + 1;
}

function formatValue(v: string | number | boolean | string[]): string {
  if (Array.isArray(v)) return `[${v.map((x) => `"${x}"`).join(", ")}]`;
  if (typeof v === "string") {
    return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(v) ? v : JSON.stringify(v);
  }
  return String(v);
}
