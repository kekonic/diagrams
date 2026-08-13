import type * as MonacoTypes from "monaco-editor";
import {
  KDiagramLanguageService,
  type CompletionItem,
  type LanguageRange,
} from "@kekonic/diagrams-language-service";

const service = new KDiagramLanguageService();
const versions = new Map<string, number>();

export function installKDiagramLanguage(
  monaco: typeof MonacoTypes,
  model: MonacoTypes.editor.ITextModel,
): MonacoTypes.IDisposable {
  sync(monaco, model);
  const disposables: MonacoTypes.IDisposable[] = [];
  disposables.push(
    model.onDidChangeContent(() => {
      sync(monaco, model);
    }),
  );
  disposables.push(
    monaco.languages.registerCompletionItemProvider("kdiagram", {
      triggerCharacters: [":", " ", "-", "("],
      provideCompletionItems(current, position) {
        ensure(monaco, current);
        const range = current.getWordUntilPosition(position);
        return {
          suggestions: service.complete(uri(current), fromMonaco(position)).map((item) => ({
            label: item.label,
            kind: completionKind(monaco, item),
            detail: item.detail,
            documentation: item.documentation,
            insertText: item.insertText ?? item.label,
            range: new monaco.Range(
              position.lineNumber,
              range.startColumn,
              position.lineNumber,
              range.endColumn,
            ),
          })),
        };
      },
    }),
  );
  disposables.push(
    monaco.languages.registerHoverProvider("kdiagram", {
      provideHover(current, position) {
        ensure(monaco, current);
        const hover = service.hover(uri(current), fromMonaco(position));
        return hover
          ? { range: toMonacoRange(hover.range), contents: [{ value: hover.markdown }] }
          : null;
      },
    }),
  );
  disposables.push(
    monaco.languages.registerDefinitionProvider("kdiagram", {
      provideDefinition(current, position) {
        ensure(monaco, current);
        const location = service.definition(uri(current), fromMonaco(position));
        return location ? { uri: current.uri, range: toMonacoRange(location.range) } : null;
      },
    }),
  );
  disposables.push(
    monaco.languages.registerReferenceProvider("kdiagram", {
      provideReferences(current, position, context) {
        ensure(monaco, current);
        return service
          .references(uri(current), fromMonaco(position), context.includeDeclaration)
          .map((item) => ({
            uri: current.uri,
            range: toMonacoRange(item.range),
          }));
      },
    }),
  );
  disposables.push(
    monaco.languages.registerRenameProvider("kdiagram", {
      provideRenameEdits(current, position, newName) {
        ensure(monaco, current);
        return {
          edits: service
            .renameWorkspace(uri(current), fromMonaco(position), newName)
            .map((edit) => ({
              resource: monaco.Uri.parse(edit.uri),
              versionId: edit.uri === uri(current) ? current.getVersionId() : undefined,
              textEdit: { range: toMonacoRange(edit.range), text: edit.newText },
            })),
        };
      },
      resolveRenameLocation(current, position) {
        ensure(monaco, current);
        const definition = service.definition(uri(current), fromMonaco(position));
        if (!definition)
          return {
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column,
            ),
            text: "",
            rejectReason: "Select a declared KDiagram identifier.",
          };
        return {
          range: toMonacoRange(definition.range),
          text: current.getValueInRange(toMonacoRange(definition.range)),
        };
      },
    }),
  );
  disposables.push(
    monaco.languages.registerDocumentSymbolProvider("kdiagram", {
      provideDocumentSymbols(current) {
        ensure(monaco, current);
        return service.documentSymbols(uri(current)).map((item) => ({
          name: item.name,
          detail: `KDiagram ${item.kind}`,
          kind:
            item.kind === "diagram"
              ? monaco.languages.SymbolKind.Namespace
              : item.kind === "group"
                ? monaco.languages.SymbolKind.Package
                : item.kind === "style"
                  ? monaco.languages.SymbolKind.Class
                  : monaco.languages.SymbolKind.Object,
          tags: [],
          range: toMonacoRange(item.range),
          selectionRange: toMonacoRange(item.range),
        }));
      },
    }),
  );
  disposables.push(
    monaco.languages.registerFoldingRangeProvider("kdiagram", {
      provideFoldingRanges(current) {
        ensure(monaco, current);
        return service
          .foldingRanges(uri(current))
          .map((item) => ({ start: item.startLine, end: item.endLine }));
      },
    }),
  );
  disposables.push(
    monaco.languages.registerDocumentFormattingEditProvider("kdiagram", {
      provideDocumentFormattingEdits(current) {
        ensure(monaco, current);
        return service
          .format(uri(current))
          .map((edit) => ({ range: toMonacoRange(edit.range), text: edit.newText }));
      },
    }),
  );
  return {
    dispose() {
      service.closeDocument(uri(model));
      for (const disposable of disposables) disposable.dispose();
    },
  };
}

function sync(monaco: typeof MonacoTypes, model: MonacoTypes.editor.ITextModel): void {
  const documentUri = uri(model);
  const version = model.getVersionId();
  versions.set(documentUri, version);
  const snapshot = service.updateDocument(documentUri, model.getValue(), version);
  monaco.editor.setModelMarkers(
    model,
    "kdiagram-language-service",
    snapshot.diagnostics.map((item) => ({
      severity:
        item.severity === "error"
          ? monaco.MarkerSeverity.Error
          : item.severity === "warning"
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Info,
      code: item.code,
      message: `${item.message}${item.hint ? `\n${item.hint}` : ""}`,
      startLineNumber: item.range.start.line,
      startColumn: item.range.start.column,
      endLineNumber: item.range.end.line,
      endColumn: Math.max(item.range.end.column, item.range.start.column + 1),
    })),
  );
}

function ensure(monaco: typeof MonacoTypes, model: MonacoTypes.editor.ITextModel): void {
  if (versions.get(uri(model)) !== model.getVersionId()) sync(monaco, model);
}

function uri(model: MonacoTypes.editor.ITextModel): string {
  return model.uri.toString();
}

function fromMonaco(position: MonacoTypes.Position): { line: number; column: number } {
  return { line: position.lineNumber, column: position.column };
}

function toMonacoRange(range: LanguageRange): MonacoTypes.Range {
  return {
    startLineNumber: range.start.line,
    startColumn: range.start.column,
    endLineNumber: range.end.line,
    endColumn: range.end.column,
  } as MonacoTypes.Range;
}

function completionKind(
  monaco: typeof MonacoTypes,
  item: CompletionItem,
): MonacoTypes.languages.CompletionItemKind {
  switch (item.kind) {
    case "keyword":
      return monaco.languages.CompletionItemKind.Keyword;
    case "kind":
      return monaco.languages.CompletionItemKind.Class;
    case "property":
      return monaco.languages.CompletionItemKind.Property;
    case "reference":
      return monaco.languages.CompletionItemKind.Reference;
    case "style":
      return monaco.languages.CompletionItemKind.Class;
    case "icon":
      return monaco.languages.CompletionItemKind.Color;
    case "theme-token":
      return monaco.languages.CompletionItemKind.Color;
    case "value":
      return monaco.languages.CompletionItemKind.Value;
  }
}
