import { describe, expect, it } from "vite-plus/test";
import {
  buildPreviewUpdateMessage,
  previewHtml,
  readPreviewAutoOpen,
  readPreviewTheme,
  renderPreviewDocument,
  shouldApplyPreviewRevision,
} from "./preview.ts";

describe("VS Code preview", () => {
  it("builds an interactive webview shell with CSP and preview script", () => {
    const html = previewHtml({
      scriptUri: "https://example.invalid/preview-webview.js",
      cspSource: "https://example.invalid",
      nonce: "test-nonce",
    });
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("https://example.invalid");
    expect(html).toContain('nonce="test-nonce"');
    expect(html).toContain("preview-webview.js");
    expect(html).toContain("<k-diagram");
    expect(html).toContain("show-view-controls");
    expect(html).toContain("animation-controls");
    expect(html).toContain('show-theme-toggle="false"');
    expect(html).toContain('type="module"');
    expect(html).toContain("--vscode-editor-background");
  });

  it("exports portable SVG with Lucide collection icons from the Node path", async () => {
    const result = await renderPreviewDocument(
      'diagram "Icons" {\n  cart: service "Cart" { icon: lucide:shopping-cart }\n}',
      "dark",
    );
    expect(result.svg).toBeTruthy();
    // Lucide shopping-cart body — proves @iconify-json resolution works for export.
    expect(result.svg).toContain("M2.05 2.05h2l2.66 12.42");
  });

  it("reads preview theme and auto-open from the diagrams configuration namespace", () => {
    expect(readPreviewTheme((_key, defaultValue) => defaultValue)).toBe("dark");
    expect(readPreviewTheme(<T>(_key: string, _defaultValue?: T) => "light" as T)).toBe("light");
    expect(readPreviewAutoOpen((_key, defaultValue) => defaultValue)).toBe(true);
    expect(readPreviewAutoOpen(<T>(_key: string, _defaultValue?: T) => false as T)).toBe(false);
  });

  it("builds revision-ordered preview host messages", () => {
    expect(buildPreviewUpdateMessage("diagram {}", "light", 3)).toEqual({
      type: "update",
      source: "diagram {}",
      theme: "light",
      revision: 3,
    });
    expect(shouldApplyPreviewRevision(3, 2)).toBe(true);
    expect(shouldApplyPreviewRevision(2, 3)).toBe(false);
  });
});
