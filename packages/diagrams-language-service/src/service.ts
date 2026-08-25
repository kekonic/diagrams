import {
  compile,
  formatSource,
  parse,
  type Diagnostic,
  type KDiagramAst,
  type SequenceStatementAst,
  type SourceRange,
  type StatementAst,
} from "@kekonic/diagrams-core";
import { builtinCatalog, LANGUAGE_KEYWORDS } from "./catalog.ts";
import type {
  CodeAction,
  CompletionItem,
  DocumentSymbol,
  DocumentChange,
  FoldingRange,
  Hover,
  LanguageExtension,
  LanguagePosition,
  LanguageSnapshot,
  Location,
  SemanticProperty,
  SemanticToken,
  TextEdit,
  WorkspaceTextEdit,
} from "./types.ts";

type SymbolRecord = {
  name: string;
  kind: "diagram" | "node" | "group" | "style" | "animation";
  range: SourceRange;
  selectionRange: SourceRange;
  detail?: string;
};

type DocumentRecord = LanguageSnapshot & {
  ast: KDiagramAst;
  symbols: SymbolRecord[];
  references: Map<string, SourceRange[]>;
};

const IDENTIFIER = /[A-Za-z_][\w-]*/gu;
const WORD_AT = /[A-Za-z_][\w-]*/u;

export class KDiagramLanguageService {
  readonly protocolVersion = 1 as const;
  readonly #documents = new Map<string, DocumentRecord>();
  readonly #extensions = new Map<string, LanguageExtension>();

  updateDocument(uri: string, source: string, version = 1): LanguageSnapshot {
    const previous = this.#documents.get(uri);
    if (previous && version < previous.version) return snapshot(previous);
    const ast = parse(source);
    const compiled = compile(ast);
    const diagnostics = dedupeDiagnostics([...ast.diagnostics, ...compiled.diagnostics]);
    const symbols = collectSymbols(source, ast);
    const references = collectReferences(source);
    const record: DocumentRecord = { uri, source, version, diagnostics, ast, symbols, references };
    this.#documents.set(uri, record);
    return snapshot(record);
  }

  applyDocumentChanges(
    uri: string,
    version: number,
    changes: readonly DocumentChange[],
  ): LanguageSnapshot {
    const current = this.#require(uri);
    if (version < current.version) return snapshot(current);
    let source = current.source;
    for (const change of changes) {
      if (!change.range) {
        source = change.text;
        continue;
      }
      const start = offsetAt(source, change.range.start);
      const end = offsetAt(source, change.range.end);
      if (end < start) throw new Error("KDiagram document change range ends before it starts");
      source = `${source.slice(0, start)}${change.text}${source.slice(end)}`;
    }
    return this.updateDocument(uri, source, version);
  }

  closeDocument(uri: string): void {
    this.#documents.delete(uri);
  }

  getDocument(uri: string): LanguageSnapshot | undefined {
    const document = this.#documents.get(uri);
    return document ? snapshot(document) : undefined;
  }

  diagnostics(uri: string): Diagnostic[] {
    return [...this.#require(uri).diagnostics];
  }

  format(uri: string): TextEdit[] {
    const document = this.#require(uri);
    const formatted = formatSource(document.source);
    return formatted === document.source
      ? []
      : [{ range: fullRange(document.source), newText: formatted }];
  }

  complete(uri: string, position: LanguagePosition): CompletionItem[] {
    const document = this.#require(uri);
    const offset = offsetAt(document.source, position);
    const before = document.source.slice(Math.max(0, offset - 160), offset);
    const customKinds = [...this.#extensions.values()].flatMap((extension) =>
      Object.keys(extension.kinds ?? {}),
    );
    const customProperties = [...this.#extensions.values()].flatMap(
      (extension) => extension.properties ?? [],
    );
    if (/\bicon\s*:\s*[\w:-]*$/u.test(before)) {
      return builtinCatalog.icons.map((label) => ({
        label,
        kind: "icon",
        detail: "Built-in icon",
      }));
    }
    if (/\bshape\s*:\s*[\w-]*$/u.test(before)) {
      return builtinCatalog.shapes.map((label) => ({
        label,
        kind: "value",
        detail: "Built-in shape",
      }));
    }
    if (/\bis\s+[\w-]*$/u.test(before)) {
      const authored = document.symbols
        .filter((item) => item.kind === "style")
        .map((item) => item.name);
      return unique([...builtinCatalog.styles, ...authored]).map((label) => ({
        label,
        kind: "style",
      }));
    }
    if (/var\(\s*--[\w-]*$/u.test(before)) {
      return builtinCatalog.themeTokens.map((label) => ({ label, kind: "theme-token" }));
    }
    const property = /\b([A-Za-z][\w-]*)\s*:\s*[\w-]*$/u.exec(before)?.[1];
    if (property) {
      const definition = [...builtinCatalog.properties, ...customProperties].find(
        (item) => item.name === property,
      );
      if (definition?.values)
        return definition.values.map((label) => ({
          label,
          kind: "value",
          detail: definition.description,
        }));
      if (property === "columns") return tableColumnCompletions(document);
      if (property === "theme")
        return ["dark", "light"].map((label) => ({ label, kind: "value" }) as CompletionItem);
    }
    if (/^\s*[A-Za-z_][\w-]*\s*:\s*[\w-]*$/u.test(linePrefix(document.source, offset))) {
      return unique([...builtinCatalog.kinds, ...customKinds]).map((label) => ({
        label,
        kind: "kind",
        detail: this.#kindDescription(label),
      }));
    }
    if (/\{[^{}]*$/u.test(before)) {
      return uniqueProperties([...builtinCatalog.properties, ...customProperties]).map((item) => ({
        label: item.name,
        kind: "property",
        detail: item.description,
        insertText: `${item.name}: `,
      }));
    }
    const ids = document.symbols.filter((item) => item.kind === "node" || item.kind === "group");
    return [
      ...LANGUAGE_KEYWORDS.map((label) => ({ label, kind: "keyword" as const })),
      ...ids.map((item) => ({ label: item.name, kind: "reference" as const, detail: item.detail })),
    ];
  }

  hover(uri: string, position: LanguagePosition): Hover | undefined {
    const document = this.#require(uri);
    const word = wordAt(document.source, offsetAt(document.source, position));
    if (!word) return undefined;
    const symbol = document.symbols.find((item) => item.name === word.value);
    if (symbol)
      return {
        range: word.range,
        markdown: `**${symbol.name}**  \nKDiagram ${symbol.kind}${symbol.detail ? ` · ${symbol.detail}` : ""}`,
      };
    const kind = builtinCatalog.kindDetails[word.value];
    if (kind)
      return {
        range: word.range,
        markdown: `**${word.value}** · ${kind.subtitle}  \nShape: \`${kind.shape}\` · Category: ${kind.category}`,
        preview: { kind: word.value, shape: kind.shape },
      };
    for (const extension of this.#extensions.values()) {
      const custom = extension.kinds?.[word.value];
      if (custom)
        return {
          range: word.range,
          markdown: `**${word.value}** · ${custom.description}${custom.shape ? `  \nShape: \`${custom.shape}\`` : ""}`,
          preview: custom.shape ? { kind: word.value, shape: custom.shape } : undefined,
        };
    }
    const property = this.#properties().find((item) => item.name === word.value);
    if (property)
      return { range: word.range, markdown: `**${property.name}**  \n${property.description}` };
    if (
      (builtinCatalog.themeTokens as readonly string[]).includes(
        word.value.startsWith("--") ? word.value : `--${word.value}`,
      )
    ) {
      return { range: word.range, markdown: `Theme token \`${word.value}\`` };
    }
    return undefined;
  }

  definition(uri: string, position: LanguagePosition): Location | undefined {
    const document = this.#require(uri);
    const word = wordAt(document.source, offsetAt(document.source, position));
    if (!word) return undefined;
    for (const candidate of [document, ...this.#documents.values()]) {
      const symbol = candidate.symbols.find((item) => item.name === word.value);
      if (symbol) return { uri: candidate.uri, range: symbol.selectionRange };
    }
    return undefined;
  }

  references(uri: string, position: LanguagePosition, includeDeclaration = true): Location[] {
    const document = this.#require(uri);
    const word = wordAt(document.source, offsetAt(document.source, position));
    if (!word) return [];
    const locations: Location[] = [];
    for (const candidate of this.#documents.values()) {
      const declaration = candidate.symbols.find(
        (item) => item.name === word.value,
      )?.selectionRange;
      locations.push(
        ...(candidate.references.get(word.value) ?? [])
          .filter((range) => includeDeclaration || !sameRange(range, declaration))
          .map((range) => ({ uri: candidate.uri, range })),
      );
    }
    return locations;
  }

  rename(uri: string, position: LanguagePosition, newName: string): TextEdit[] {
    return this.renameWorkspace(uri, position, newName)
      .filter((edit) => edit.uri === uri)
      .map(({ range, newText }) => ({ range, newText }));
  }

  renameWorkspace(uri: string, position: LanguagePosition, newName: string): WorkspaceTextEdit[] {
    if (!/^[A-Za-z_][\w-]*$/u.test(newName))
      throw new Error(`Invalid KDiagram identifier: ${newName}`);
    const document = this.#require(uri);
    const word = wordAt(document.source, offsetAt(document.source, position));
    if (
      !word ||
      ![...this.#documents.values()].some((candidate) =>
        candidate.symbols.some((item) => item.name === word.value),
      )
    )
      return [];
    return [...this.#documents.values()].flatMap((candidate) =>
      (candidate.references.get(word.value) ?? []).map((range) => ({
        uri: candidate.uri,
        range,
        newText: newName,
      })),
    );
  }

  documentSymbols(uri: string): DocumentSymbol[] {
    const document = this.#require(uri);
    return document.symbols.map(({ name, kind, range }) => ({ name, kind, range }));
  }

  foldingRanges(uri: string): FoldingRange[] {
    const source = this.#require(uri).source;
    const stack: Array<{ line: number }> = [];
    const ranges: FoldingRange[] = [];
    let line = 1;
    let quote = false;
    let comment = false;
    for (let offset = 0; offset < source.length; offset++) {
      const char = source[offset]!;
      const next = source[offset + 1];
      if (char === "\n") {
        line++;
        comment = false;
        continue;
      }
      if (!quote && !comment && char === "/" && next === "/") {
        comment = true;
        offset++;
        continue;
      }
      if (comment) continue;
      if (char === '"' && source[offset - 1] !== "\\") quote = !quote;
      if (quote) continue;
      if (char === "{") stack.push({ line });
      if (char === "}") {
        const start = stack.pop();
        if (start && line > start.line) ranges.push({ startLine: start.line, endLine: line });
      }
    }
    return ranges;
  }

  semanticTokens(uri: string): SemanticToken[] {
    const source = this.#require(uri).source;
    const tokens: SemanticToken[] = [];
    const pattern =
      /"(?:[^"\\]|\\.)*"|(?:-->|->|=>|~>|\.>|-x>|<->|<-)|\b\d+(?:\.\d+)?\b|[A-Za-z_][\w-]*/gu;
    for (const match of source.matchAll(pattern)) {
      const value = match[0];
      const offset = match.index;
      const position = positionAt(source, offset);
      let type: SemanticToken["type"] = "variable";
      if (value.startsWith('"')) type = "string";
      else if (/^\d/u.test(value)) type = "number";
      else if ((builtinCatalog.edgeOperators as readonly string[]).includes(value))
        type = "operator";
      else if ((LANGUAGE_KEYWORDS as readonly string[]).includes(value)) type = "keyword";
      else if (this.#kindDescription(value)) type = "type";
      else if (
        this.#properties().some((item) => item.name === value) &&
        /^\s*:/u.test(source.slice(offset + value.length))
      )
        type = "property";
      else if (
        this.#require(uri).symbols.some((item) => item.kind === "style" && item.name === value)
      )
        type = "class";
      tokens.push({ line: position.line, column: position.column, length: value.length, type });
    }
    return tokens;
  }

  codeActions(uri: string): CodeAction[] {
    const document = this.#require(uri);
    const actions: CodeAction[] = [];
    const formatting = this.format(uri);
    if (formatting.length)
      actions.push({ title: "Format KDiagram document", kind: "source.format", edits: formatting });
    for (const diagnostic of document.diagnostics) {
      const replacement = /Did you mean (?:“|")([^”"]+)(?:”|")\?/u.exec(diagnostic.hint ?? "")?.[1];
      if (!replacement) continue;
      actions.push({
        title: `Replace with ‘${replacement}’`,
        kind: "quickfix",
        edits: [{ range: diagnostic.range, newText: replacement }],
        diagnosticCode: diagnostic.code,
      });
    }
    for (const match of document.source.matchAll(/\broomy\b/gu)) {
      actions.push({
        title: "Migrate deprecated density ‘roomy’ to ‘spacious’",
        kind: "source.migrate",
        edits: [
          {
            range: rangeFromOffsets(document.source, match.index, match.index + match[0].length),
            newText: "spacious",
          },
        ],
      });
    }
    return actions;
  }

  registerExtension(extension: LanguageExtension): () => void {
    const protocolVersion: number = extension.protocolVersion;
    if (protocolVersion !== 1)
      throw new Error(`Unsupported language extension protocol: ${protocolVersion}`);
    if (!extension.id.trim()) throw new Error("Language extension id is required");
    this.#extensions.set(extension.id, extension);
    return () => {
      this.#extensions.delete(extension.id);
    };
  }

  #properties(): SemanticProperty[] {
    return uniqueProperties([
      ...builtinCatalog.properties,
      ...[...this.#extensions.values()].flatMap((extension) => extension.properties ?? []),
    ]);
  }

  #kindDescription(kind: string): string | undefined {
    const builtin = builtinCatalog.kindDetails[kind];
    if (builtin) return `${builtin.subtitle} · ${builtin.category} · ${builtin.shape}`;
    for (const extension of this.#extensions.values()) {
      const custom = extension.kinds?.[kind];
      if (custom) return custom.description;
    }
    return undefined;
  }

  #require(uri: string): DocumentRecord {
    const document = this.#documents.get(uri);
    if (!document) throw new Error(`Unknown KDiagram document: ${uri}`);
    return document;
  }
}

function snapshot(document: DocumentRecord): LanguageSnapshot {
  return {
    uri: document.uri,
    source: document.source,
    version: document.version,
    diagnostics: [...document.diagnostics],
  };
}

function dedupeDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((item) => {
    const key = `${item.code}:${item.message}:${item.range.start.offset}:${item.range.end.offset}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function collectSymbols(source: string, ast: KDiagramAst): SymbolRecord[] {
  const symbols: SymbolRecord[] = [];
  for (const top of ast.body) {
    const name =
      top.name ??
      (top.type === "Sequence"
        ? "Sequence"
        : top.type === "Model"
          ? "Model"
          : top.diagramKind === "state"
            ? "State"
            : "Diagram");
    symbols.push({
      name,
      kind: "diagram",
      range: top.range,
      selectionRange: findTextRange(source, top.range, top.name ?? top.type.toLowerCase()),
    });
    if (top.type === "Model") {
      visitStatements(source, top.statements, symbols);
      for (const view of top.views) {
        symbols.push({
          name: view.name,
          kind: "diagram",
          range: view.range,
          selectionRange: findTextRange(source, view.range, view.name),
          detail: "view",
        });
        visitStatements(source, view.statements as StatementAst[], symbols);
      }
      continue;
    }
    visitStatements(source, top.statements, symbols);
  }
  return symbols;
}

function visitStatements(
  source: string,
  statements: readonly (StatementAst | SequenceStatementAst)[],
  symbols: SymbolRecord[],
): void {
  for (const statement of statements) {
    switch (statement.type) {
      case "Node":
        symbols.push({
          name: statement.id,
          kind: "node",
          range: statement.range,
          selectionRange: findTextRange(source, statement.range, statement.id),
          detail: statement.kind,
        });
        break;
      case "Group":
        if (statement.id)
          symbols.push({
            name: statement.id,
            kind: "group",
            range: statement.range,
            selectionRange: findTextRange(source, statement.range, statement.id),
            detail: statement.groupKind,
          });
        visitStatements(source, statement.statements, symbols);
        break;
      case "Style":
        symbols.push({
          name: statement.name,
          kind: "style",
          range: statement.range,
          selectionRange: findTextRange(source, statement.range, statement.name),
          detail: statement.target,
        });
        break;
      case "AnimationBlock":
        symbols.push({
          name: statement.name,
          kind: "animation",
          range: statement.range,
          selectionRange: findTextRange(source, statement.range, statement.name),
        });
        break;
      case "SequenceCreate":
        symbols.push({
          name: statement.node.id,
          kind: "node",
          range: statement.range,
          selectionRange: findTextRange(source, statement.range, statement.node.id),
          detail: statement.node.kind,
        });
        break;
      case "SequenceFragment":
        for (const operand of statement.operands) {
          visitStatements(source, operand.statements, symbols);
        }
        break;
    }
  }
}

function collectReferences(source: string): Map<string, SourceRange[]> {
  const references = new Map<string, SourceRange[]>();
  for (const match of semanticIdentifierMatches(source)) {
    const ranges = references.get(match[0]) ?? [];
    const index = match.index!;
    ranges.push(rangeFromOffsets(source, index, index + match[0].length));
    references.set(match[0], ranges);
  }
  return references;
}

function semanticIdentifierMatches(source: string): RegExpMatchArray[] {
  const masked = source.split("");
  let quote = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!;
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      else masked[index] = " ";
      continue;
    }
    if (blockComment) {
      masked[index] = char === "\n" ? "\n" : " ";
      if (char === "*" && next === "/") {
        masked[index + 1] = " ";
        blockComment = false;
        index++;
      }
      continue;
    }
    if (!quote && char === "/" && next === "/") {
      masked[index] = masked[index + 1] = " ";
      lineComment = true;
      index++;
      continue;
    }
    if (!quote && char === "/" && next === "*") {
      masked[index] = masked[index + 1] = " ";
      blockComment = true;
      index++;
      continue;
    }
    if (char === '"' && source[index - 1] !== "\\") {
      quote = !quote;
      masked[index] = " ";
      continue;
    }
    if (quote) masked[index] = char === "\n" ? "\n" : " ";
  }
  return [...masked.join("").matchAll(IDENTIFIER)];
}

function tableColumnCompletions(document: DocumentRecord): CompletionItem[] {
  const names = new Set<string>();
  for (const match of document.source.matchAll(/\b(?:pk|fk|uk)?\s*([A-Za-z_][\w-]*)\s*:/gu))
    names.add(match[1]!);
  return [...names].sort().map((label) => ({ label, kind: "reference", detail: "Table column" }));
}

function wordAt(source: string, offset: number): { value: string; range: SourceRange } | undefined {
  let start = Math.min(offset, source.length);
  while (start > 0 && /[\w-]/u.test(source[start - 1]!)) start--;
  const match = WORD_AT.exec(source.slice(start));
  if (!match || match.index !== 0) return undefined;
  return { value: match[0], range: rangeFromOffsets(source, start, start + match[0].length) };
}

function findTextRange(source: string, within: SourceRange, text: string): SourceRange {
  const offset = source.indexOf(text, within.start.offset);
  if (offset < 0 || offset >= within.end.offset) return within;
  return rangeFromOffsets(source, offset, offset + text.length);
}

export function positionAt(source: string, offset: number): Required<LanguagePosition> {
  const bounded = Math.max(0, Math.min(offset, source.length));
  const prefix = source.slice(0, bounded);
  const line = prefix.split("\n").length;
  const lastNewline = prefix.lastIndexOf("\n");
  return { line, column: bounded - lastNewline, offset: bounded };
}

export function offsetAt(source: string, position: LanguagePosition): number {
  if (position.offset != null) return Math.max(0, Math.min(position.offset, source.length));
  const lines = source.split("\n");
  let offset = 0;
  for (let line = 1; line < position.line; line++) offset += (lines[line - 1]?.length ?? 0) + 1;
  return Math.min(source.length, offset + Math.max(0, position.column - 1));
}

function rangeFromOffsets(source: string, start: number, end: number): SourceRange {
  return { start: positionAt(source, start), end: positionAt(source, end) };
}

function fullRange(source: string): SourceRange {
  return rangeFromOffsets(source, 0, source.length);
}

function linePrefix(source: string, offset: number): string {
  return source.slice(source.lastIndexOf("\n", offset - 1) + 1, offset);
}

function sameRange(left: SourceRange, right: SourceRange | undefined): boolean {
  return Boolean(
    right && left.start.offset === right.start.offset && left.end.offset === right.end.offset,
  );
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueProperties(values: readonly SemanticProperty[]): SemanticProperty[] {
  return [...new Map(values.map((item) => [item.name, item])).values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}
