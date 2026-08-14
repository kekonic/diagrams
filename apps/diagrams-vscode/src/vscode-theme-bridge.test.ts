import { describe, expect, it } from "vite-plus/test";
import {
  buildVsCodePreviewTokens,
  resolveVsCodeBodyMode,
  VSCODE_PREVIEW_THEME,
} from "./vscode-theme-bridge.ts";

describe("VS Code preview theme bridge", () => {
  it("resolves light and dark from webview body classes", () => {
    expect(resolveVsCodeBodyMode("vscode-dark")).toBe("dark");
    expect(resolveVsCodeBodyMode("vscode-high-contrast")).toBe("dark");
    expect(resolveVsCodeBodyMode("vscode-light")).toBe("light");
    expect(resolveVsCodeBodyMode("monaco-workbench vscode-high-contrast-light")).toBe("light");
  });

  it("retints accent and neutrals from workbench colors", () => {
    const tokens = buildVsCodePreviewTokens("dark", {
      accent: "#3b82f6",
      background: "#0b1220",
      foreground: "#e2e8f0",
      muted: "#94a3b8",
      border: "#334155",
      surface: "#111827",
    });
    expect(VSCODE_PREVIEW_THEME).toBe("vscode-preview");
    expect(tokens["--kd-accent"]).toBe("#3b82f6");
    expect(tokens["--kd-bg"]).toBe("#0b1220");
    expect(tokens["--kd-text"]).toBe("#e2e8f0");
    expect(tokens["--kd-service-stroke"]).toBe("#3b82f6");
    expect(tokens["--kd-success"]).toBeTruthy();
    expect(tokens["--kd-warning"]).toBeTruthy();
    expect(tokens["--kd-group-fill"]).toContain("color-mix");
  });
});
