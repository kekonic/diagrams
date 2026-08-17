import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { encodeKDiagramFenceSource, isKDiagramFence } from "@kekonic/diagrams-markdown-it";
import * as vscode from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
} from "vscode-languageclient/node";
import {
  buildPreviewUpdateMessage,
  createPreviewNonce,
  previewHtml,
  readPreviewAutoOpen,
  readPreviewTheme,
  renderPreviewDocument,
} from "./preview.ts";

let client: LanguageClient | undefined;
let preview: vscode.WebviewPanel | undefined;
let previewDocument: vscode.TextDocument | undefined;
let extensionUri: vscode.Uri | undefined;
let renderSequence = 0;
let updateTimer: ReturnType<typeof setTimeout> | undefined;

const PREVIEW_DEBOUNCE_MS = 240;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<{ extendMarkdownIt: (md: unknown) => unknown }> {
  extensionUri = context.extensionUri;
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
    vscode.commands.registerCommand("diagrams.openPreview", () => openPreview()),
    vscode.commands.registerCommand("diagrams.exportSvg", exportSvg),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document === previewDocument) schedulePreviewUpdate(event.document);
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor || editor.document.languageId !== "kdiagram") return;
      if (preview) {
        previewDocument = editor.document;
        schedulePreviewUpdate(editor.document);
        return;
      }
      if (previewAutoOpen()) void openPreview(editor.document);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("diagrams.preview") || !previewDocument) return;
      schedulePreviewUpdate(previewDocument);
    }),
    vscode.window.onDidChangeActiveColorTheme(() => {
      void preview?.webview.postMessage({ type: "retheme" });
    }),
    {
      dispose: () => {
        if (updateTimer) clearTimeout(updateTimer);
      },
    },
  );

  if (previewAutoOpen() && vscode.window.activeTextEditor?.document.languageId === "kdiagram") {
    void openPreview(vscode.window.activeTextEditor.document);
  }

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

function previewTheme(): "dark" | "light" {
  const configuration = vscode.workspace.getConfiguration("diagrams");
  return readPreviewTheme(configuration.get.bind(configuration));
}

function previewAutoOpen(): boolean {
  const configuration = vscode.workspace.getConfiguration("diagrams");
  return readPreviewAutoOpen(configuration.get.bind(configuration));
}

async function openPreview(document = vscode.window.activeTextEditor?.document): Promise<void> {
  if (!document || document.languageId !== "kdiagram") {
    void vscode.window.showInformationMessage("Open a .kdiagram document to preview it.");
    return;
  }
  if (!extensionUri) return;

  previewDocument = document;
  if (!preview) {
    preview = vscode.window.createWebviewPanel(
      "kdiagram.preview",
      "Kekonic Diagrams Preview",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist")],
      },
    );
    preview.onDidDispose(() => {
      preview = undefined;
      previewDocument = undefined;
    });
    preview.webview.onDidReceiveMessage((message: unknown) => {
      if (
        message &&
        typeof message === "object" &&
        (message as { type?: string }).type === "ready"
      ) {
        if (previewDocument) pushPreviewUpdate(previewDocument);
      }
    });
    const nonce = createPreviewNonce();
    const scriptUri = preview.webview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "preview-webview.js"))
      .toString();
    preview.webview.html = previewHtml({
      scriptUri,
      cspSource: preview.webview.cspSource,
      nonce,
    });
  } else {
    preview.reveal(vscode.ViewColumn.Beside, true);
  }

  preview.title = `Preview: ${document.fileName.split(/[\\/]/).pop() ?? "KDiagram"}`;
  pushPreviewUpdate(document);
}

function schedulePreviewUpdate(document: vscode.TextDocument): void {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => {
    updateTimer = undefined;
    pushPreviewUpdate(document);
  }, PREVIEW_DEBOUNCE_MS);
}

function pushPreviewUpdate(document: vscode.TextDocument): void {
  if (!preview) return;
  const revision = ++renderSequence;
  preview.title = `Preview: ${document.fileName.split(/[\\/]/).pop() ?? "KDiagram"}`;
  void preview.webview.postMessage(
    buildPreviewUpdateMessage(document.getText(), previewTheme(), revision),
  );
}

async function exportSvg(): Promise<void> {
  const document = vscode.window.activeTextEditor?.document;
  if (!document || document.languageId !== "kdiagram") return;
  const theme = previewTheme();
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
