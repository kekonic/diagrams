import { KDiagram, type RenderResult } from "@kekonic/diagrams";

export async function renderPreviewDocument(
  source: string,
  theme: "dark" | "light",
): Promise<RenderResult> {
  return KDiagram.renderToSvg(source, { theme, snapshotTheme: true });
}

export function previewHtml(svg: string | undefined, message = ""): string {
  const body = svg ?? `<p class="error">${escapeHtml(message || "Unable to render diagram")}</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><meta name="viewport" content="width=device-width"><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);font-family:var(--vscode-font-family)}svg{display:block;max-width:100%;max-height:100%;width:auto;height:auto}.error{padding:1rem;color:var(--vscode-errorForeground)}</style></head><body>${body}</body></html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
