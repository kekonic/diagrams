import type { Readable, Writable } from "node:stream";
import {
  KDiagramLanguageService,
  type CodeAction,
  type CompletionItem,
  type LanguagePosition,
  type LanguageRange,
  type SemanticToken,
  type TextEdit,
} from "@kekonic/diagrams-language-service";

type JsonRpcId = string | number | null;
type JsonRpcMessage = { jsonrpc: "2.0"; id?: JsonRpcId; method?: string; params?: unknown };
type RpcResponse = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string };
};
type OpenParams = { textDocument: { uri: string; version: number; text: string } };
type ChangeParams = {
  textDocument: { uri: string; version: number };
  contentChanges: Array<{
    text: string;
    range?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  }>;
};
type CloseParams = { textDocument: { uri: string } };
type PositionParams = {
  textDocument: { uri: string };
  position: { line: number; character: number };
};
type RenameParams = PositionParams & { newName: string };
type ReferenceParams = PositionParams & { context?: { includeDeclaration?: boolean } };

const TOKEN_TYPES: SemanticToken["type"][] = [
  "keyword",
  "string",
  "number",
  "operator",
  "property",
  "type",
  "variable",
  "class",
];

export async function runLanguageServer(
  input: Readable = process.stdin,
  output: Writable = process.stdout,
): Promise<number> {
  const service = new KDiagramLanguageService();
  let buffer = Buffer.alloc(0);
  let shutdown = false;
  let exited = false;

  const send = (message: object): void => {
    const body = Buffer.from(JSON.stringify(message), "utf8");
    output.write(`Content-Length: ${body.byteLength}\r\n\r\n`);
    output.write(body);
  };
  const respond = (id: JsonRpcId, result: unknown): void =>
    send({ jsonrpc: "2.0", id, result } satisfies RpcResponse);
  const fail = (id: JsonRpcId, code: number, message: string): void =>
    send({ jsonrpc: "2.0", id, error: { code, message } } satisfies RpcResponse);
  const publish = (uri: string): void =>
    send({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri, diagnostics: service.diagnostics(uri).map(toLspDiagnostic) },
    });

  const handle = (message: JsonRpcMessage): void => {
    const id = message.id ?? null;
    try {
      switch (message.method) {
        case "initialize":
          respond(id, {
            serverInfo: { name: "kdiagram", version: "1" },
            capabilities: {
              textDocumentSync: { openClose: true, change: 2 },
              completionProvider: { triggerCharacters: [":", " ", "-", "("] },
              hoverProvider: true,
              definitionProvider: true,
              referencesProvider: true,
              renameProvider: { prepareProvider: false },
              documentSymbolProvider: true,
              foldingRangeProvider: true,
              documentFormattingProvider: true,
              codeActionProvider: true,
              semanticTokensProvider: {
                legend: { tokenTypes: TOKEN_TYPES, tokenModifiers: [] },
                full: true,
              },
            },
          });
          return;
        case "initialized":
          return;
        case "shutdown":
          shutdown = true;
          respond(id, null);
          return;
        case "exit":
          exited = true;
          return;
        case "textDocument/didOpen": {
          const params = message.params as OpenParams;
          service.updateDocument(
            params.textDocument.uri,
            params.textDocument.text,
            params.textDocument.version,
          );
          publish(params.textDocument.uri);
          return;
        }
        case "textDocument/didChange": {
          const params = message.params as ChangeParams;
          service.applyDocumentChanges(
            params.textDocument.uri,
            params.textDocument.version,
            params.contentChanges.map((change) => ({
              text: change.text,
              range: change.range
                ? {
                    start: fromLspPosition(change.range.start),
                    end: fromLspPosition(change.range.end),
                  }
                : undefined,
            })),
          );
          publish(params.textDocument.uri);
          return;
        }
        case "textDocument/didClose": {
          const params = message.params as CloseParams;
          service.closeDocument(params.textDocument.uri);
          send({
            jsonrpc: "2.0",
            method: "textDocument/publishDiagnostics",
            params: { uri: params.textDocument.uri, diagnostics: [] },
          });
          return;
        }
        case "textDocument/completion": {
          const params = message.params as PositionParams;
          respond(
            id,
            service
              .complete(params.textDocument.uri, fromLspPosition(params.position))
              .map(toLspCompletion),
          );
          return;
        }
        case "textDocument/hover": {
          const params = message.params as PositionParams;
          const hover = service.hover(params.textDocument.uri, fromLspPosition(params.position));
          respond(
            id,
            hover
              ? {
                  contents: { kind: "markdown", value: hover.markdown },
                  range: toLspRange(hover.range),
                }
              : null,
          );
          return;
        }
        case "textDocument/definition": {
          const params = message.params as PositionParams;
          const location = service.definition(
            params.textDocument.uri,
            fromLspPosition(params.position),
          );
          respond(id, location ? { uri: location.uri, range: toLspRange(location.range) } : null);
          return;
        }
        case "textDocument/references": {
          const params = message.params as ReferenceParams;
          respond(
            id,
            service
              .references(
                params.textDocument.uri,
                fromLspPosition(params.position),
                params.context?.includeDeclaration ?? true,
              )
              .map((item) => ({ uri: item.uri, range: toLspRange(item.range) })),
          );
          return;
        }
        case "textDocument/rename": {
          const params = message.params as RenameParams;
          const edits = service.renameWorkspace(
            params.textDocument.uri,
            fromLspPosition(params.position),
            params.newName,
          );
          const changes: Record<string, object[]> = {};
          for (const edit of edits) (changes[edit.uri] ??= []).push(toLspTextEdit(edit));
          respond(id, { changes });
          return;
        }
        case "textDocument/documentSymbol": {
          const params = message.params as Pick<PositionParams, "textDocument">;
          respond(
            id,
            service.documentSymbols(params.textDocument.uri).map((item) => ({
              name: item.name,
              kind: symbolKind(item.kind),
              range: toLspRange(item.range),
              selectionRange: toLspRange(item.range),
            })),
          );
          return;
        }
        case "textDocument/foldingRange": {
          const params = message.params as Pick<PositionParams, "textDocument">;
          respond(
            id,
            service
              .foldingRanges(params.textDocument.uri)
              .map((item) => ({ startLine: item.startLine - 1, endLine: item.endLine - 1 })),
          );
          return;
        }
        case "textDocument/formatting": {
          const params = message.params as Pick<PositionParams, "textDocument">;
          respond(id, service.format(params.textDocument.uri).map(toLspTextEdit));
          return;
        }
        case "textDocument/codeAction": {
          const params = message.params as Pick<PositionParams, "textDocument">;
          respond(
            id,
            service
              .codeActions(params.textDocument.uri)
              .map((action) => toLspCodeAction(params.textDocument.uri, action)),
          );
          return;
        }
        case "textDocument/semanticTokens/full": {
          const params = message.params as Pick<PositionParams, "textDocument">;
          respond(id, {
            data: encodeSemanticTokens(service.semanticTokens(params.textDocument.uri)),
          });
          return;
        }
        case "$/cancelRequest":
          return;
        default:
          if (message.id !== undefined)
            fail(id, -32601, `Method not found: ${message.method ?? "<missing>"}`);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (message.id !== undefined) fail(id, -32603, detail);
      else
        send({ jsonrpc: "2.0", method: "window/logMessage", params: { type: 1, message: detail } });
    }
  };

  return await new Promise<number>((resolve) => {
    input.on("data", (chunk: Buffer | string) => {
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      while (true) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd < 0) break;
        const header = buffer.subarray(0, headerEnd).toString("ascii");
        const length = /(?:^|\r\n)Content-Length:\s*(\d+)/iu.exec(header)?.[1];
        if (!length) {
          buffer = Buffer.alloc(0);
          break;
        }
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + Number(length);
        if (buffer.length < bodyEnd) break;
        const body = buffer.subarray(bodyStart, bodyEnd).toString("utf8");
        buffer = buffer.subarray(bodyEnd);
        try {
          handle(JSON.parse(body) as JsonRpcMessage);
        } catch {
          fail(null, -32700, "Parse error");
        }
        if (exited) {
          resolve(shutdown ? 0 : 1);
          return;
        }
      }
    });
    input.on("end", () => resolve(shutdown ? 0 : 1));
    input.on("error", () => resolve(1));
  });
}

function fromLspPosition(position: { line: number; character: number }): LanguagePosition {
  return { line: position.line + 1, column: position.character + 1 };
}

function toLspRange(range: LanguageRange): object {
  return {
    start: {
      line: Math.max(0, range.start.line - 1),
      character: Math.max(0, range.start.column - 1),
    },
    end: { line: Math.max(0, range.end.line - 1), character: Math.max(0, range.end.column - 1) },
  };
}

function toLspDiagnostic(
  diagnostic: ReturnType<KDiagramLanguageService["diagnostics"]>[number],
): object {
  return {
    range: toLspRange(diagnostic.range),
    severity: diagnostic.severity === "error" ? 1 : diagnostic.severity === "warning" ? 2 : 3,
    code: diagnostic.code,
    source: "kdiagram",
    message: diagnostic.message,
    data: diagnostic.hint ? { hint: diagnostic.hint } : undefined,
  };
}

function toLspCompletion(item: CompletionItem): object {
  const kinds: Record<CompletionItem["kind"], number> = {
    keyword: 14,
    kind: 7,
    property: 10,
    value: 12,
    reference: 6,
    style: 7,
    icon: 12,
    "theme-token": 21,
  };
  return {
    label: item.label,
    kind: kinds[item.kind],
    detail: item.detail,
    documentation: item.documentation,
    insertText: item.insertText,
  };
}

function toLspTextEdit(edit: TextEdit): object {
  return { range: toLspRange(edit.range), newText: edit.newText };
}

function toLspCodeAction(uri: string, action: CodeAction): object {
  return {
    title: action.title,
    kind: action.kind,
    diagnostics: action.diagnosticCode ? [{ code: action.diagnosticCode }] : undefined,
    edit: action.edits.length ? { changes: { [uri]: action.edits.map(toLspTextEdit) } } : undefined,
  };
}

function symbolKind(kind: string): number {
  return kind === "diagram"
    ? 2
    : kind === "group"
      ? 3
      : kind === "style"
        ? 5
        : kind === "animation"
          ? 12
          : 13;
}

function encodeSemanticTokens(tokens: SemanticToken[]): number[] {
  const sorted = [...tokens].sort(
    (left, right) => left.line - right.line || left.column - right.column,
  );
  const data: number[] = [];
  let lastLine = 1;
  let lastColumn = 1;
  for (const token of sorted) {
    const deltaLine = token.line - lastLine;
    const deltaColumn = deltaLine === 0 ? token.column - lastColumn : token.column - 1;
    data.push(deltaLine, deltaColumn, token.length, TOKEN_TYPES.indexOf(token.type), 0);
    lastLine = token.line;
    lastColumn = token.column;
  }
  return data;
}
