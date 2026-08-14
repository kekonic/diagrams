import { randomBytes } from "node:crypto";
import { KDiagram, type RenderResult } from "@kekonic/diagrams";

export type PreviewTheme = "dark" | "light";

export type PreviewHostMessage = {
  type: "update";
  source: string;
  theme: PreviewTheme;
  revision: number;
};

export async function renderPreviewDocument(
  source: string,
  theme: PreviewTheme,
): Promise<RenderResult> {
  return KDiagram.renderToSvg(source, { theme, snapshotTheme: true });
}

export function readPreviewTheme(
  get: <T>(key: string, defaultValue?: T) => T | undefined,
): PreviewTheme {
  return get<PreviewTheme>("preview.theme", "dark") ?? "dark";
}

export function readPreviewAutoOpen(
  get: <T>(key: string, defaultValue?: T) => T | undefined,
): boolean {
  return get<boolean>("preview.autoOpen", true) ?? true;
}

export function createPreviewNonce(): string {
  return randomBytes(16).toString("base64url");
}

export function buildPreviewUpdateMessage(
  source: string,
  theme: PreviewTheme,
  revision: number,
): PreviewHostMessage {
  return { type: "update", source, theme, revision };
}

export function shouldApplyPreviewRevision(incoming: number, applied: number): boolean {
  return incoming >= applied;
}

export type PreviewHtmlOptions = {
  scriptUri: string;
  cspSource: string;
  nonce: string;
};

/** Interactive side-preview shell. Source/theme arrive via postMessage after load. */
export function previewHtml(options: PreviewHtmlOptions): string {
  const { scriptUri, cspSource, nonce } = options;
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' ${cspSource}`,
    `style-src 'unsafe-inline' ${cspSource}`,
    `font-src ${cspSource}`,
    `img-src ${cspSource} data:`,
    `connect-src ${cspSource}`,
    `worker-src ${cspSource} blob:`,
  ].join("; ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html, body {
      height: 100%;
      margin: 0;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
    }
    #diagram {
      display: block;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <k-diagram
    id="diagram"
    theme="dark"
    height="100%"
    frameless
    show-theme-toggle="false"
    show-view-controls
    animation-controls
  ></k-diagram>
  <script type="module" nonce="${nonce}" src="${escapeHtml(scriptUri)}"></script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
