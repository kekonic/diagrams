import { describe, expect, it } from "vite-plus/test";
import { previewHtml, renderPreviewDocument } from "./preview.ts";

describe("VS Code preview", () => {
  it("renders accessible, portable SVG in a script-free webview", async () => {
    const result = await renderPreviewDocument('diagram "T" { api: service "API" }', "light");
    const html = previewHtml(result.svg);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('role="img"');
    expect(html).toContain('data-node-id="api"');
    expect(html).not.toContain("<script");
  });
});
