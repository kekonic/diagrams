import type { Diagnostic, SourceRange } from "../types/geometry.ts";
import type {
  DiagramAst,
  EdgeAst,
  KDiagramAst,
  GroupAst,
  GroupMemberAst,
  NodeAst,
  PropertyMap,
  SequenceAst,
  SequenceFragmentAst,
  SequenceFragmentOperandAst,
  SequenceStatementAst,
  StatementAst,
  StyleAst,
  StyleRefAst,
  AnimationBlockAst,
  AnimationCueAst,
  AnimationTargetAst,
  TopLevelNode,
} from "./ast.ts";
import { tokenize, type Token } from "./lexer.ts";
import { normalizeSequenceFragmentOperator } from "../types/sequence.ts";

export function parse(source: string): KDiagramAst {
  const diagnostics: Diagnostic[] = [];
  const tokens = tokenize(source, diagnostics);
  const parser = new Parser(tokens, diagnostics, source);
  return parser.parseDocument();
}

class Parser {
  private pos = 0;

  constructor(
    private tokens: Token[],
    private diagnostics: Diagnostic[],
    private source: string,
  ) {}

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset] ?? this.tokens[this.tokens.length - 1]!;
  }

  private advance(): Token {
    return this.tokens[this.pos++] ?? this.tokens[this.tokens.length - 1]!;
  }

  private at(type: string, value?: string): boolean {
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }

  /** Soft keyword / identifier word match. */
  private atWord(value: string): boolean {
    const t = this.peek();
    return t.type === "identifier" && t.value === value;
  }

  private skipNewlines(): void {
    this.skipTrivia();
  }

  /** Skip newlines and line comments (trivia). */
  private skipTrivia(): void {
    while (this.at("newline") || this.at("comment")) this.advance();
  }

  private error(code: string, message: string, range: SourceRange, hint?: string): void {
    this.diagnostics.push({ severity: "error", code, message, range, hint });
  }

  parseDocument(): KDiagramAst {
    this.skipNewlines();
    let version: number | undefined;

    if (this.atWord("kdiagram")) {
      this.advance();
      const num = this.advance();
      if (num.type === "number") version = Number(num.value);
      this.skipNewlines();
    }

    const body: TopLevelNode[] = [];
    while (!this.at("eof")) {
      this.skipNewlines();
      if (this.at("eof")) break;
      if (this.atWord("diagram")) {
        body.push(this.parseDiagram("flow"));
      } else if (this.atWord("state")) {
        body.push(this.parseDiagram("state"));
      } else if (this.atWord("sequence")) {
        body.push(this.parseSequence());
      } else {
        this.error("FM001", `Unexpected token "${this.peek().value}"`, this.peek().range);
        this.advance();
      }
      this.skipNewlines();
    }

    return { type: "Document", version, body, diagnostics: this.diagnostics };
  }

  private parseSequence(): SequenceAst {
    const start = this.peek().range.start;
    this.advance(); // sequence
    this.skipTrivia();
    let name: string | undefined;
    if (this.at("string")) {
      name = this.advance().value;
      this.skipTrivia();
    }
    if (!this.at("lbrace")) {
      this.error("FM002", 'Expected "{" to open sequence', this.peek().range);
    } else {
      this.advance();
    }
    const statements: SequenceStatementAst[] = [];

    while (!this.at("rbrace") && !this.at("eof")) {
      this.skipNewlines();
      if (this.at("rbrace") || this.at("eof")) break;
      const stmt = this.parseSequenceStatement();
      if (!stmt) continue;
      if (Array.isArray(stmt)) statements.push(...stmt);
      else statements.push(stmt);
    }

    if (!this.at("rbrace")) {
      this.error("FM002", 'Expected "}" to close sequence', this.peek().range);
    } else {
      this.advance();
    }

    const end = this.tokens[Math.min(this.pos, this.tokens.length - 1)]!.range.end;
    return {
      type: "Sequence",
      name,
      statements,
      range: { start, end },
    };
  }

  private parseSequenceStatement(): SequenceStatementAst | SequenceStatementAst[] | null {
    if (this.at("identifier") && this.peek(1).type === "colon") {
      const id = this.advance();
      this.advance(); // colon
      return this.parseNode(id.value, id.range);
    }

    if (this.atWord("activate")) return this.parseSequenceActivate();
    if (this.atWord("deactivate")) return this.parseSequenceDeactivate();
    if (this.atWord("create")) return this.parseSequenceCreate();
    if (this.atWord("destroy")) return this.parseSequenceDestroy();
    if (this.atWord("note")) return this.parseSequenceNote();
    if (this.atWord("autonumber")) {
      const tok = this.advance();
      return { type: "SequenceAutonumber", range: tok.range };
    }
    if (this.atWord("divider")) {
      return this.parseSequenceDivider();
    }
    if (
      this.atWord("alt") ||
      this.atWord("alternate") ||
      this.atWord("opt") ||
      this.atWord("optional") ||
      this.atWord("loop") ||
      this.atWord("par") ||
      this.atWord("parallel") ||
      this.atWord("critical") ||
      this.atWord("break") ||
      this.atWord("group") ||
      this.atWord("section") ||
      this.atWord("box")
    ) {
      return this.parseSequenceFragment();
    }
    if (this.atWord("style")) return this.parseStyle() as SequenceStatementAst;
    if (this.atWord("direction") || this.atWord("density")) {
      return this.parseDirective() as SequenceStatementAst;
    }
    if (this.atWord("layout")) return this.parseLayoutBlock() as SequenceStatementAst;
    if (this.atWord("edges")) return this.parseEdgePolicyBlock() as SequenceStatementAst;
    if (this.atWord("render")) return this.parseRenderBlock() as SequenceStatementAst;
    if (this.atWord("presentation")) return this.parsePresentationBlock() as SequenceStatementAst;
    if (this.atWord("animation")) return this.parseAnimationBlock() as SequenceStatementAst;

    // Found message: `* -> participant`
    if (this.at("star") && this.peek(1).type === "edgeOp") {
      const star = this.advance();
      return this.parseEdgeChain("*", undefined, star.range);
    }

    if (this.at("identifier")) {
      if (this.looksLikeStyleRef()) {
        return this.parseStyleRefStatement() as SequenceStatementAst;
      }
      const id = this.advance();
      if (this.at("dot") || this.at("edgeOp")) {
        const from = this.parseQualifiedName(id.value, id.range);
        return this.parseEdgeChain(from.nodeId, from.column, id.range);
      }
      this.error("FM003", `Unexpected identifier "${id.value}"`, id.range);
      return null;
    }

    this.error("FM004", `Unexpected token "${this.peek().value}"`, this.peek().range);
    this.advance();
    return null;
  }

  private parseSequenceActivate(): SequenceStatementAst {
    const startTok = this.advance();
    const idTok = this.advance();
    if (idTok.type !== "identifier") {
      this.error("FM140", "Expected participant id after activate", idTok.range);
      return {
        type: "SequenceActivate",
        participantId: "",
        range: startTok.range,
      };
    }
    return {
      type: "SequenceActivate",
      participantId: idTok.value,
      range: { start: startTok.range.start, end: idTok.range.end },
    };
  }

  private parseSequenceDeactivate(): SequenceStatementAst {
    const startTok = this.advance();
    const idTok = this.advance();
    if (idTok.type !== "identifier") {
      this.error("FM141", "Expected participant id after deactivate", idTok.range);
      return {
        type: "SequenceDeactivate",
        participantId: "",
        range: startTok.range,
      };
    }
    return {
      type: "SequenceDeactivate",
      participantId: idTok.value,
      range: { start: startTok.range.start, end: idTok.range.end },
    };
  }

  private parseSequenceCreate(): SequenceStatementAst {
    const startTok = this.advance(); // create
    this.skipTrivia();
    if (!(this.at("identifier") && this.peek(1).type === "colon")) {
      this.error("FM142", 'Expected `create id: kind "Label"`', this.peek().range);
      return {
        type: "SequenceCreate",
        node: {
          type: "Node",
          id: "",
          kind: "participant",
          properties: {},
          styleRefs: [],
          range: startTok.range,
        },
        range: startTok.range,
      };
    }
    const id = this.advance();
    this.advance(); // colon
    const node = this.parseNode(id.value, id.range);
    return {
      type: "SequenceCreate",
      node,
      range: { start: startTok.range.start, end: node.range.end },
    };
  }

  private parseSequenceDestroy(): SequenceStatementAst {
    const startTok = this.advance();
    const idTok = this.advance();
    if (idTok.type !== "identifier") {
      this.error("FM143", "Expected participant id after destroy", idTok.range);
      return {
        type: "SequenceDestroy",
        participantId: "",
        range: startTok.range,
      };
    }
    return {
      type: "SequenceDestroy",
      participantId: idTok.value,
      range: { start: startTok.range.start, end: idTok.range.end },
    };
  }

  private parseSequenceNote(): SequenceStatementAst {
    const startTok = this.advance(); // note
    this.skipTrivia();
    let placement: "over" | "left" | "right" = "over";
    if (this.atWord("over")) {
      this.advance();
      placement = "over";
    } else if (this.atWord("left")) {
      this.advance();
      this.skipTrivia();
      if (this.atWord("of")) this.advance();
      placement = "left";
    } else if (this.atWord("right")) {
      this.advance();
      this.skipTrivia();
      if (this.atWord("of")) this.advance();
      placement = "right";
    } else {
      this.error("FM144", "Expected note placement (over | left of | right of)", this.peek().range);
    }
    this.skipTrivia();
    const participantIds: string[] = [];
    while (this.at("identifier")) {
      participantIds.push(this.advance().value);
      this.skipTrivia();
      if (this.at("comma")) {
        this.advance();
        this.skipTrivia();
        continue;
      }
      break;
    }
    let text = "";
    if (this.at("string")) {
      text = this.advance().value;
    } else {
      this.error("FM145", "Expected note text string", this.peek().range);
    }
    return {
      type: "SequenceNote",
      placement,
      participantIds,
      text,
      range: {
        start: startTok.range.start,
        end: this.peek(-1)?.range.end ?? startTok.range.end,
      },
    };
  }

  private parseSequenceDivider(): SequenceStatementAst {
    const startTok = this.advance(); // divider
    this.skipTrivia();
    let label: string | undefined;
    if (this.at("string")) label = this.advance().value;
    return {
      type: "SequenceDivider",
      label,
      range: {
        start: startTok.range.start,
        end: this.peek(-1)?.range.end ?? startTok.range.end,
      },
    };
  }

  private parseSequenceFragment(): SequenceFragmentAst {
    const startTok = this.peek();
    const operator = normalizeSequenceFragmentOperator(startTok.value) ?? "section";
    this.advance();
    this.skipTrivia();
    let label: string | undefined;
    if (this.at("string")) {
      label = this.advance().value;
      this.skipTrivia();
    }
    const styleRefs = this.parseOptionalIsStyleRefs();
    this.skipTrivia();
    const operands: SequenceFragmentOperandAst[] = [];
    // Opening `is …` styles the first operand (and the fragment frame fallback).
    const first = this.parseSequenceFragmentBody(label, styleRefs);
    operands.push(first);

    // alternate … else|otherwise …  /  parallel … and|also …
    while (
      (operator === "alternate" && (this.atWord("else") || this.atWord("otherwise"))) ||
      (operator === "parallel" && (this.atWord("and") || this.atWord("also")))
    ) {
      this.advance();
      this.skipTrivia();
      let opLabel: string | undefined;
      if (this.at("string")) {
        opLabel = this.advance().value;
        this.skipTrivia();
      }
      const opStyleRefs = this.parseOptionalIsStyleRefs();
      this.skipTrivia();
      operands.push(this.parseSequenceFragmentBody(opLabel, opStyleRefs));
    }

    return {
      type: "SequenceFragment",
      operator,
      label,
      styleRefs,
      operands,
      range: {
        start: startTok.range.start,
        end: this.peek(-1)?.range.end ?? startTok.range.end,
      },
    };
  }

  private parseSequenceFragmentBody(
    label?: string,
    styleRefs: string[] = [],
  ): SequenceFragmentOperandAst {
    const start = this.peek().range.start;
    if (!this.at("lbrace")) {
      this.error("FM146", 'Expected "{" to open fragment body', this.peek().range);
      return { label, styleRefs, statements: [], range: this.peek().range };
    }
    this.advance();
    const statements: SequenceStatementAst[] = [];
    while (!this.at("rbrace") && !this.at("eof")) {
      this.skipNewlines();
      if (this.at("rbrace") || this.at("eof")) break;
      const stmt = this.parseSequenceStatement();
      if (!stmt) continue;
      if (Array.isArray(stmt)) statements.push(...stmt);
      else statements.push(stmt);
    }
    if (!this.at("rbrace")) {
      this.error("FM146", 'Expected "}" to close fragment body', this.peek().range);
    } else {
      this.advance();
    }
    return {
      label,
      styleRefs,
      statements,
      range: { start, end: this.peek(-1)?.range.end ?? start },
    };
  }

  private parseDiagram(diagramKind: "flow" | "state"): DiagramAst {
    const start = this.peek().range.start;
    this.advance(); // diagram | state
    this.skipTrivia();
    // Title is optional: `diagram { … }` or `diagram "Title" { … }`.
    let name: string | undefined;
    if (this.at("string")) {
      name = this.advance().value;
      this.skipTrivia();
    }
    if (!this.at("lbrace")) {
      this.error("FM002", `Expected "{" to open ${diagramKind} diagram`, this.peek().range);
    } else {
      this.advance();
    }
    const statements: StatementAst[] = [];

    while (!this.at("rbrace") && !this.at("eof")) {
      this.skipNewlines();
      if (this.at("rbrace") || this.at("eof")) break;
      const stmt = this.parseStatement(true);
      if (!stmt) continue;
      if (Array.isArray(stmt)) statements.push(...stmt);
      else statements.push(stmt);
    }

    if (!this.at("rbrace")) {
      this.error("FM002", 'Expected "}" to close diagram', this.peek().range);
    } else {
      this.advance();
    }

    const end = this.tokens[Math.min(this.pos, this.tokens.length - 1)]!.range.end;
    return {
      type: "Diagram",
      diagramKind,
      name,
      statements,
      range: { start, end },
    };
  }

  private parseStatement(inGroup = false): StatementAst | StatementAst[] | null {
    // Soft keywords: `id: kind` is always a node (so `edge: gateway` / `layout: service` work).
    // Group layout hints (`arrange:`, `gap:`, …) stay directives inside groups.
    if (this.at("identifier") && this.peek(1).type === "colon") {
      if (inGroup && isGroupLayoutHint(this.peek().value)) {
        return this.parseDirective();
      }
      const id = this.advance();
      this.advance(); // colon
      return this.parseNode(id.value, id.range);
    }

    if (
      this.atWord("group") ||
      this.atWord("boundary") ||
      this.atWord("zone") ||
      this.atWord("swimlane")
    ) {
      return this.parseGroup();
    }
    if (this.atWord("style")) return this.parseStyle();
    if (this.atWord("direction") || this.atWord("density")) {
      return this.parseDirective();
    }
    if (this.atWord("layout")) return this.parseLayoutBlock();
    if (this.atWord("edges")) return this.parseEdgePolicyBlock();
    if (this.atWord("render")) return this.parseRenderBlock();
    if (this.atWord("presentation")) return this.parsePresentationBlock();
    if (this.atWord("animation")) return this.parseAnimationBlock();

    if (this.at("identifier")) {
      if (this.looksLikeStyleRef()) {
        return this.parseStyleRefStatement();
      }
      if (inGroup && this.looksLikeGroupMember()) {
        return this.parseGroupMemberList();
      }
      const id = this.advance();
      if (this.at("dot") || this.at("edgeOp")) {
        const from = this.parseQualifiedName(id.value, id.range);
        return this.parseEdgeChain(from.nodeId, from.column, id.range);
      }
      this.error("FM003", `Unexpected identifier "${id.value}"`, id.range);
      return null;
    }

    this.error("FM004", `Unexpected token "${this.peek().value}"`, this.peek().range);
    this.advance();
    return null;
  }

  private parseNode(id: string, idRange: SourceRange): NodeAst {
    const start = idRange.start;
    const kindTok = this.advance();
    const kind = kindTok.value;
    let label: string | undefined;
    if (this.at("string")) label = this.advance().value;

    // `deadLetter: dlq "…" is failed { icon: … }` or `{ … } is failed`
    const styleRefs = this.parseOptionalIsStyleRefs();
    const properties = this.parseOptionalProperties();
    styleRefs.push(...this.parseOptionalIsStyleRefs());
    const end = this.peek(-1)?.range.end ?? kindTok.range.end;
    return { type: "Node", id, kind, label, properties, styleRefs, range: { start, end } };
  }

  private parseOptionalIsStyleRefs(): string[] {
    const refs: string[] = [];
    while (this.atWord("is")) {
      this.advance();
      const styleTok = this.advance();
      if (styleTok.type !== "identifier") {
        this.error("FM008", 'Expected style name after "is"', styleTok.range);
        break;
      }
      refs.push(styleTok.value);
    }
    return refs;
  }

  private parseQualifiedName(
    firstId: string,
    _firstRange: SourceRange,
  ): { nodeId: string; column?: string } {
    if (!this.at("dot")) return { nodeId: firstId };
    this.advance();
    const colTok = this.advance();
    if (colTok.type !== "identifier") {
      this.error("FM007", "Expected column name after '.'", colTok.range);
      return { nodeId: firstId };
    }
    return { nodeId: firstId, column: colTok.value };
  }

  private parseEdgeChain(
    from: string,
    fromColumn: string | undefined,
    fromRange: SourceRange,
  ): EdgeAst[] {
    const edges: EdgeAst[] = [];
    let currentFrom = from;
    let currentFromColumn = fromColumn;
    let chainStart = fromRange.start;

    while (this.at("edgeOp")) {
      const opTok = this.advance();
      let toNodeId: string;
      let toColumn: string | undefined;
      let toRange: SourceRange;
      if (this.at("star")) {
        const star = this.advance();
        toNodeId = "*";
        toRange = star.range;
      } else {
        const toTok = this.advance();
        if (toTok.type !== "identifier") {
          this.error(
            "FM005",
            "Expected target node id after edge operator",
            toTok.range,
            "Add a target node id after the edge operator.",
          );
          break;
        }
        const to = this.parseQualifiedName(toTok.value, toTok.range);
        toNodeId = to.nodeId;
        toColumn = to.column;
        toRange = toTok.range;
      }

      let label: string | undefined;
      if (this.at("string")) label = this.advance().value;
      const properties = this.parseOptionalProperties();
      const end = this.peek(-1)?.range.end ?? toRange.end;

      edges.push({
        type: "Edge",
        from: currentFrom,
        to: toNodeId,
        fromColumn: currentFromColumn,
        toColumn,
        op: opTok.value as EdgeAst["op"],
        label,
        properties,
        styleRefs: [],
        range: { start: chainStart, end },
      });

      currentFrom = toNodeId;
      currentFromColumn = toColumn;
      chainStart = toRange.start;

      if (this.atWord("is")) {
        this.advance();
        const styleTok = this.advance();
        edges[edges.length - 1]!.styleRefs.push(styleTok.value);
      }
    }

    return edges;
  }

  private looksLikeStyleRef(): boolean {
    let p = this.pos;
    while (this.tokens[p]?.type === "identifier") {
      p++;
      if (this.tokens[p]?.type === "comma") {
        p++;
        continue;
      }
      break;
    }
    const t = this.tokens[p];
    return t?.type === "identifier" && t.value === "is";
  }

  private looksLikeGroupMember(): boolean {
    if (!this.at("identifier")) return false;
    const next = this.peek(1);
    if (next.type === "colon" || next.type === "edgeOp" || next.type === "dot") return false;
    if (next.type === "identifier" && next.value === "is") return false;
    return true;
  }

  private parseStyleRefStatement(): StyleRefAst {
    const start = this.peek().range.start;
    const targetIds: string[] = [this.advance().value];
    while (this.at("comma")) {
      this.advance();
      targetIds.push(this.advance().value);
    }
    this.advance(); // is
    const styleName = this.advance().value;
    const end = this.peek(-1)?.range.end ?? start;
    return { type: "StyleRef", targetIds, styleName, range: { start, end } };
  }

  private parseGroupMemberList(): GroupMemberAst {
    const start = this.peek().range.start;
    const nodeIds: string[] = [this.advance().value];
    while (this.at("comma")) {
      this.advance();
      nodeIds.push(this.advance().value);
    }
    const end = this.peek(-1)?.range.end ?? start;
    return { type: "GroupMember", nodeIds, range: { start, end } };
  }

  private parseGroup(): GroupAst {
    const start = this.peek().range.start;
    const kindTok = this.advance();
    const groupKind = kindTok.value as GroupAst["groupKind"];
    let id: string | undefined;
    let label: string | undefined;

    if (this.at("identifier")) id = this.advance().value;
    if (this.at("string")) label = this.advance().value;

    const properties: PropertyMap = {};
    if (this.at("lbrace")) {
      this.advance();
      const statements: StatementAst[] = [];
      while (!this.at("rbrace") && !this.at("eof")) {
        this.skipNewlines();
        if (this.at("rbrace") || this.at("eof")) break;
        const stmt = this.parseStatement(true);
        if (!stmt) continue;
        if (Array.isArray(stmt)) statements.push(...stmt);
        else statements.push(stmt);
      }
      if (this.at("rbrace")) this.advance();
      const end = this.peek(-1)?.range.end ?? kindTok.range.end;
      return { type: "Group", id, label, groupKind, statements, properties, range: { start, end } };
    }

    this.error("FM006", "Expected { after group declaration", this.peek().range);
    return {
      type: "Group",
      id,
      label,
      groupKind,
      statements: [],
      properties,
      range: { start, end: kindTok.range.end },
    };
  }

  private parseStyle(): StyleAst {
    const start = this.advance().range.start;
    const nameTok = this.advance();
    const name = nameTok.value;
    let target: StyleAst["target"] = "node";
    if (this.atWord("for")) {
      this.advance();
      if (this.atWord("edge")) {
        this.advance();
        target = "edge";
      } else if (this.atWord("fragment")) {
        this.advance();
        target = "fragment";
      }
    }
    const properties = this.parseBlockProperties();
    return {
      type: "Style",
      name,
      target,
      properties,
      range: { start, end: this.peek(-1)?.range.end ?? nameTok.range.end },
    };
  }

  private parseDirective(): StatementAst {
    const keywordTok = this.advance();
    const start = keywordTok.range.start;
    const name = keywordTok.value;
    let value: string | number | boolean | string[] | undefined;
    if (this.at("colon")) this.advance();
    if (this.at("lbracket")) {
      value = this.parseIdentifierList();
    } else if (
      !this.at("newline") &&
      !this.at("comment") &&
      !this.at("rbrace") &&
      !this.at("eof")
    ) {
      value = this.parsePropertyValue();
    }
    return {
      type: "Directive",
      name,
      value,
      range: { start, end: this.peek(-1)?.range.end ?? keywordTok.range.end },
    };
  }

  private parseLayoutBlock(): StatementAst {
    const start = this.advance().range.start;
    const properties = this.parseBlockProperties();
    return {
      type: "LayoutBlock",
      properties,
      range: { start, end: this.peek(-1)?.range.end ?? { line: 1, column: 1, offset: 0 } },
    };
  }

  private parseEdgePolicyBlock(): StatementAst {
    const start = this.advance().range.start;
    const properties = this.parseBlockProperties();
    return {
      type: "EdgePolicyBlock",
      properties,
      range: { start, end: this.peek(-1)?.range.end ?? { line: 1, column: 1, offset: 0 } },
    };
  }

  private parseRenderBlock(): StatementAst {
    const start = this.advance().range.start;
    const properties = this.at("lbrace") ? this.parseBlockProperties() : {};
    return {
      type: "RenderBlock",
      properties,
      range: { start, end: this.peek(-1)?.range.end ?? { line: 1, column: 1, offset: 0 } },
    };
  }

  private parsePresentationBlock(): StatementAst {
    const start = this.advance().range.start;
    const properties = this.at("lbrace") ? this.parseBlockProperties() : {};
    return {
      type: "PresentationBlock",
      properties,
      range: { start, end: this.peek(-1)?.range.end ?? { line: 1, column: 1, offset: 0 } },
    };
  }

  private parseAnimationBlock(): AnimationBlockAst {
    const startTok = this.advance(); // animation
    this.skipTrivia();
    let name = "Animation";
    if (this.at("string")) {
      name = this.advance().value;
      this.skipTrivia();
    } else {
      this.error("FM120", "Expected quoted animation name after `animation`", this.peek().range);
    }
    if (!this.at("lbrace")) {
      this.error("FM121", 'Expected "{" to open animation block', this.peek().range);
      return {
        type: "AnimationBlock",
        name,
        cues: [],
        range: { start: startTok.range.start, end: startTok.range.end },
      };
    }
    this.advance(); // {
    const cues: AnimationCueAst[] = [];
    while (!this.at("rbrace") && !this.at("eof")) {
      this.skipTrivia();
      if (this.at("rbrace") || this.at("eof")) break;
      const cue = this.parseAnimationCue();
      if (cue) cues.push(cue);
    }
    if (this.at("rbrace")) this.advance();
    else this.error("FM121", 'Expected "}" to close animation block', this.peek().range);
    return {
      type: "AnimationBlock",
      name,
      cues,
      range: {
        start: startTok.range.start,
        end: this.peek(-1)?.range.end ?? startTok.range.end,
      },
    };
  }

  private parseAnimationCue(): AnimationCueAst | null {
    const start = this.peek().range;
    if (this.atWord("loop")) {
      this.advance();
      return { type: "loop", range: start };
    }
    if (this.atWord("wait")) {
      this.advance();
      const durationMs = this.parseDurationMs() ?? 400;
      return {
        type: "wait",
        durationMs,
        range: { start: start.start, end: this.peek(-1)?.range.end ?? start.end },
      };
    }
    if (this.atWord("parallel")) {
      this.advance();
      this.skipTrivia();
      if (!this.at("lbrace")) {
        this.error("FM121", 'Expected "{" to open parallel animation group', this.peek().range);
        return null;
      }
      this.advance(); // {
      const cues: AnimationCueAst[] = [];
      while (!this.at("rbrace") && !this.at("eof")) {
        this.skipTrivia();
        if (this.at("rbrace") || this.at("eof")) break;
        if (this.atWord("parallel")) {
          this.error(
            "FM130",
            "Nested parallel groups are not supported",
            this.peek().range,
            "Keep parallel groups one level deep",
          );
          this.advance();
          continue;
        }
        if (this.atWord("loop")) {
          this.error(
            "FM129",
            "`loop` belongs on the animation block, not inside parallel",
            this.peek().range,
          );
          this.advance();
          continue;
        }
        const cue = this.parseAnimationCue();
        if (cue) cues.push(cue);
      }
      if (this.at("rbrace")) this.advance();
      else this.error("FM121", 'Expected "}" to close parallel group', this.peek().range);
      return {
        type: "parallel",
        cues,
        range: { start: start.start, end: this.peek(-1)?.range.end ?? start.end },
      };
    }
    if (this.atWord("dim") || this.atWord("activate") || this.atWord("pulse")) {
      const op = this.advance().value as "dim" | "activate" | "pulse";
      const targets = this.parseAnimationTargets();
      let durationMs: number | undefined;
      if (op === "pulse" && this.atWord("for")) {
        this.advance();
        durationMs = this.parseDurationMs();
      }
      const range = {
        start: start.start,
        end: this.peek(-1)?.range.end ?? start.end,
      };
      if (op === "pulse") return { type: "pulse", targets, durationMs, range };
      return { type: op, targets, range };
    }
    if (this.atWord("flow")) {
      this.advance();
      const path = this.parseAnimationPath();
      let durationMs: number | undefined;
      if (this.atWord("for")) {
        this.advance();
        durationMs = this.parseDurationMs();
      }
      return {
        type: "flow",
        path,
        durationMs,
        range: { start: start.start, end: this.peek(-1)?.range.end ?? start.end },
      };
    }
    this.error(
      "FM122",
      `Unexpected animation cue "${this.peek().value}"`,
      this.peek().range,
      "Expected dim, activate, pulse, flow, wait, parallel, or loop",
    );
    this.advance();
    return null;
  }

  private parseAnimationTargets(): AnimationTargetAst[] {
    const targets: AnimationTargetAst[] = [];
    for (;;) {
      this.skipTrivia();
      if (this.at("star")) {
        this.advance();
        targets.push({ type: "all" });
      } else if (this.at("identifier")) {
        const from = this.advance().value;
        if (this.at("edgeOp") && this.peek().value === "->") {
          this.advance();
          if (!this.at("identifier")) {
            this.error(
              "FM123",
              "Expected node id after `->` in animation target",
              this.peek().range,
            );
            break;
          }
          const to = this.advance().value;
          targets.push({ type: "edge", from, to });
        } else {
          targets.push({ type: "node", id: from });
        }
      } else {
        break;
      }
      this.skipTrivia();
      if (this.at("comma")) {
        this.advance();
        continue;
      }
      break;
    }
    if (targets.length === 0) {
      this.error("FM124", "Expected animation target (* or node id)", this.peek().range);
    }
    return targets;
  }

  private parseAnimationPath(): string[] {
    const path: string[] = [];
    if (!this.at("identifier")) {
      this.error("FM125", "Expected node id to start flow path", this.peek().range);
      return path;
    }
    path.push(this.advance().value);
    while (this.at("edgeOp") && this.peek().value === "->") {
      this.advance();
      if (!this.at("identifier")) {
        this.error("FM125", "Expected node id after `->` in flow path", this.peek().range);
        break;
      }
      path.push(this.advance().value);
    }
    if (path.length < 2) {
      this.error("FM126", "flow path needs at least two node ids (a -> b)", this.peek().range);
    }
    return path;
  }

  /** Parse `800ms`, `1.5s`, or bare number (milliseconds). */
  private parseDurationMs(): number | undefined {
    if (!this.at("number")) {
      this.error("FM127", "Expected duration (e.g. 800ms or 1.5s)", this.peek().range);
      return undefined;
    }
    const n = Number(this.advance().value);
    if (!Number.isFinite(n)) return undefined;
    if (this.at("identifier") && (this.peek().value === "ms" || this.peek().value === "s")) {
      const unit = this.advance().value;
      return unit === "s" ? Math.round(n * 1000) : Math.round(n);
    }
    return Math.round(n);
  }

  private parseBlockProperties(): PropertyMap {
    const props: PropertyMap = {};
    if (!this.at("lbrace")) return props;
    this.advance();
    while (!this.at("rbrace") && !this.at("eof")) {
      this.skipTrivia();
      if (this.at("identifier")) {
        const key = this.advance().value;
        if (this.at("colon")) this.advance();
        // Structured ERD columns: `columns { id: uuid PK … }`
        if (key === "columns" && this.at("lbrace")) {
          props[key] = this.parseColumnsBlock();
          continue;
        }
        if (this.at("lbracket")) {
          props[key] = this.parseIdentifierList();
          continue;
        }
        if (this.at("newline") || this.at("comment") || this.at("rbrace") || this.at("eof")) {
          continue;
        }
        // CSS custom properties keep raw line text (`#hex`, `var(...)`, color-mix, …).
        // `iconColor` is a CSS color shorthand for `--icon-color`.
        props[key] =
          key.startsWith("--") || key === "iconColor"
            ? this.parseCssValue()
            : this.parsePropertyValue();
      } else if (!this.at("rbrace")) {
        this.advance();
      }
    }
    if (this.at("rbrace")) this.advance();
    return props;
  }

  /**
   * Property values: numbers, booleans, strings, identifiers,
   * and qualified ids like `lucide:user` / `logos:aws`.
   */
  private parsePropertyValue(): string | number | boolean {
    const val = this.advance();
    if (val.type === "number") return Number(val.value);
    if (val.value === "true" || val.value === "false") {
      return val.value === "true";
    }
    if (val.type === "string") return val.value;
    let text = val.value;
    // `collection:name` (Iconify / Lucide-style) — keep consuming `:` + identifier segments.
    while (this.at("colon") && this.peek(1).type === "identifier") {
      this.advance(); // :
      text += `:${this.advance().value}`;
    }
    return text;
  }

  /**
   * CSS custom-property values on a style/node — slice source through end of line so
   * `#hex`, `var(...)`, and `color-mix(...)` keep spaces and punctuation.
   */
  private parseCssValue(): string {
    if (this.at("string")) return this.advance().value;
    if (this.at("newline") || this.at("comment") || this.at("rbrace") || this.at("eof")) {
      return "";
    }
    const start = this.peek().range.start.offset;
    let end = start;
    while (!this.at("newline") && !this.at("comment") && !this.at("rbrace") && !this.at("eof")) {
      end = this.advance().range.end.offset;
    }
    return this.source.slice(start, end).trim();
  }

  /**
   * Parse `columns { name: type FLAGS … }` into compact column specs
   * (same strings `parseTableColumnSpec` already understands).
   */
  private parseColumnsBlock(): string[] {
    const cols: string[] = [];
    if (!this.at("lbrace")) return cols;
    this.advance(); // {
    while (!this.at("rbrace") && !this.at("eof")) {
      this.skipTrivia();
      if (this.at("rbrace") || this.at("eof")) break;

      if (this.peek().type !== "identifier") {
        this.error("FM113", "Expected column name in columns block", this.peek().range);
        this.advance();
        continue;
      }
      const nameTok = this.advance();
      if (this.at("colon")) this.advance();

      const parts: string[] = [];
      while (
        !this.at("newline") &&
        !this.at("comment") &&
        !this.at("rbrace") &&
        !this.at("eof") &&
        !this.at("comma")
      ) {
        const t = this.advance();
        parts.push(t.value);
      }

      let note: string | undefined;
      if (this.at("comment")) {
        note = this.advance().value || undefined;
      }
      if (this.at("comma")) this.advance();

      const body = joinColumnParts(parts);
      const spec = note ? `${nameTok.value}: ${body} // ${note}` : `${nameTok.value}: ${body}`;
      cols.push(spec.trim());
    }
    if (this.at("rbrace")) this.advance();
    return cols;
  }

  private parseOptionalProperties(): PropertyMap {
    if (!this.at("lbrace")) return {};
    return this.parseBlockProperties();
  }

  private parseIdentifierList(): string[] {
    const items: string[] = [];
    if (!this.at("lbracket")) return items;
    this.advance();
    while (!this.at("rbracket") && !this.at("eof")) {
      this.skipTrivia();
      if (this.at("rbracket")) break;
      items.push(this.advance().value);
      if (this.at("comma")) this.advance();
    }
    if (this.at("rbracket")) this.advance();
    return items;
  }
}

/** Join column RHS tokens so `customers . id` becomes `customers.id`. */
function joinColumnParts(parts: string[]): string {
  if (parts.length === 0) return "";
  let out = "";
  for (const part of parts) {
    if (part === ".") {
      out = out.trimEnd() + ".";
      continue;
    }
    if (out.endsWith(".")) {
      out += part;
      continue;
    }
    out += out ? ` ${part}` : part;
  }
  return out.trim();
}

const GROUP_LAYOUT_HINTS = new Set([
  "padding",
  "arrange",
  "align",
  "gap",
  "columns",
  "rows",
  "column",
  "row",
  "span",
  "colSpan",
  "rowSpan",
  "chrome",
  "icon",
  "iconPaint",
  "iconColor",
]);

function isGroupLayoutHint(name: string): boolean {
  return GROUP_LAYOUT_HINTS.has(name);
}
