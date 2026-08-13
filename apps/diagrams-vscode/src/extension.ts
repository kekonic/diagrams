import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { encodeKDiagramFenceSource, isKDiagramFence } from "@kekonic/diagrams-markdown-it";
import * as vscode from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";
import { previewHtml, renderPreviewDocument } from "./preview.ts";

let client: LanguageClient | undefined;
let preview: vscode.WebviewPanel | undefined;
let previewDocument: vscode.TextDocument | undefined;
let renderSequence = 0;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<{ extendMarkdownIt: (md: unknown) => unknown }> {
  const serverModule = join(context.extensionPath, "dist", "server.mjs");
  const serverOptions: ServerOptions = {
    command: process.execPath,
    args: [serverModule],
    options: { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "kdiagram" },
      { scheme: "untitled", language: "kdiagram" },
    ],
    synchronize: { fileEvents: vscode.workspace.createFileSystemWatcher("**/*.kdiagram") },
  };
  client = new LanguageClient(
    "kdiagram",
    "Kekonic Diagrams Language Server",
    serverOptions,
    clientOptions,
  );
  context.subscriptions.push(client);
  await client.start();

  context.subscriptions.push(
    vscode.commands.registerCommand("diagrams.openPreview", openPreview),
    vscode.commands.registerCommand("diagrams.exportSvg", exportSvg),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === previewDocument) void updatePreview(event.document);
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (preview && editor?.document.languageId === "kdiagram") {
        previewDocument = editor.document;
        void updatePreview(editor.document);
      }
    }),
  );

  return {
    extendMarkdownIt(md: unknown): unknown {
      // Markdown-it emits a safe placeholder; the contributed preview script performs the
      // asynchronous KDiagram layout pass inside VS Code's Markdown preview.
      const markdown = md as {
        renderer: { rules: Record<string, (...args: unknown[]) => string> };
      };
      const original = markdown.renderer.rules.fence;
      markdown.renderer.rules.fence = (tokens: unknown, index: unknown, ...args: unknown[]) => {
        const list = tokens as Array<{ info: string; content: string }>;
        if (!isKDiagramFence(list[index as number]?.info ?? "")) {
          return original?.(tokens, index, ...args) ?? "";
        }
        const source = encodeKDiagramFenceSource(list[index as number]?.content ?? "");
        return `<figure class="kdiagram-markdown-diagram" data-kdiagram-source="${source}"></figure>`;
      };
      return md;
    },
  };
}

export async function deactivate(): Promise<void> {
  await client?.stop();
}

async function openPreview(): Promise<void> {
  const document = vscode.window.activeTextEditor?.document;
  if (!document || document.languageId !== "kdiagram") {
    void vscode.window.showInformationMessage("Open a .kdiagram document to preview it.");
    return;
  }
  previewDocument = document;
  preview ??= vscode.window.createWebviewPanel(
    "kdiagram.preview",
    "Kekonic Diagrams Preview",
    vscode.ViewColumn.Beside,
    { enableScripts: false, retainContextWhenHidden: true },
  );
  preview.onDidDispose(() => {
    preview = undefined;
    previewDocument = undefined;
  });
  await updatePreview(document);
}

async function updatePreview(document: vscode.TextDocument): Promise<void> {
  if (!preview) return;
  const sequence = ++renderSequence;
  const theme = vscode.workspace
    .getConfiguration("kdiagram")
    .get<"dark" | "light">("preview.theme", "dark");
  const result = await renderPreviewDocument(document.getText(), theme);
  if (sequence !== renderSequence || !preview) return;
  preview.title = `Preview: ${document.fileName.split(/[\\/]/).pop() ?? "KDiagram"}`;
  preview.webview.html = previewHtml(
    result.svg,
    result.diagnostics.map((item) => item.message).join("\n"),
  );
}

async function exportSvg(): Promise<void> {
  const document = vscode.window.activeTextEditor?.document;
  if (!document || document.languageId !== "kdiagram") return;
  const theme = vscode.workspace
    .getConfiguration("kdiagram")
    .get<"dark" | "light">("preview.theme", "dark");
  const result = await renderPreviewDocument(document.getText(), theme);
  if (!result.svg) {
    void vscode.window.showErrorMessage(result.diagnostics.map((item) => item.message).join("; "));
    return;
  }
  const target = await vscode.window.showSaveDialog({
    defaultUri: document.uri.with({ path: document.uri.path.replace(/\.kdiagram$/i, ".svg") }),
    filters: { SVG: ["svg"] },
  });
  if (target) await writeFile(target.fsPath, result.svg, "utf8");
}
