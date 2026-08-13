import type { Diagnostic, SourceRange } from "@kekonic/diagrams-core";

export type LanguagePosition = { line: number; column: number; offset?: number };
export type LanguageRange = SourceRange;
export type TextEdit = { range: LanguageRange; newText: string };
export type WorkspaceTextEdit = TextEdit & { uri: string };
export type DocumentChange = {
  text: string;
  range?: { start: LanguagePosition; end: LanguagePosition };
};

export type CompletionKind =
  | "keyword"
  | "kind"
  | "property"
  | "value"
  | "reference"
  | "style"
  | "icon"
  | "theme-token";

export type CompletionItem = {
  label: string;
  kind: CompletionKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
};

export type Hover = {
  range: LanguageRange;
  markdown: string;
  preview?: { kind: string; shape: string };
};
export type Location = { uri: string; range: LanguageRange };
export type DocumentSymbol = {
  name: string;
  kind: "diagram" | "node" | "group" | "style" | "animation";
  range: LanguageRange;
  children?: DocumentSymbol[];
};
export type FoldingRange = { startLine: number; endLine: number };
export type SemanticToken = {
  line: number;
  column: number;
  length: number;
  type: "keyword" | "string" | "number" | "operator" | "property" | "type" | "variable" | "class";
};
export type CodeAction = {
  title: string;
  kind: "quickfix" | "source.format" | "source.migrate";
  edits: TextEdit[];
  diagnosticCode?: string;
};

export type LanguageSnapshot = {
  uri: string;
  version: number;
  source: string;
  diagnostics: Diagnostic[];
};

export type SemanticProperty = {
  name: string;
  description: string;
  values?: readonly string[];
};

export type LanguageExtension = {
  protocolVersion: 1;
  id: string;
  kinds?: Record<string, { description: string; shape?: string }>;
  properties?: SemanticProperty[];
};
