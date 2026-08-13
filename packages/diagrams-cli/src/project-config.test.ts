import { describe, expect, it } from "vite-plus/test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCommand } from "./command-model.ts";
import { findProjectConfig, resolveRenderSettings } from "./project-config.ts";

describe("project export configuration", () => {
  it("discovers config upward and resolves profile and CLI precedence", () => {
    const root = mkdtempSync(join(tmpdir(), "kdiagram-config-"));
    const nested = join(root, "docs", "architecture");
    mkdirSync(nested, { recursive: true });
    const configPath = join(root, "kekonic-diagrams.config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        version: 1,
        defaultProfile: "paper",
        themes: { brand: { "--kd-bg": "#fff" } },
        profiles: {
          paper: { theme: "brand", snapshotTheme: true, background: "theme", printSafe: true },
        },
      }),
    );
    expect(findProjectConfig(nested)).toBe(configPath);
    expect(resolveRenderSettings(parseCommand(["render", "x.kdiagram"]), nested)).toMatchObject({
      theme: "brand",
      snapshotTheme: true,
      background: "theme",
      printSafe: true,
      profileName: "paper",
    });
    expect(
      resolveRenderSettings(parseCommand(["render", "--theme", "dark", "x.kdiagram"]), nested),
    ).toMatchObject({ theme: "dark" });
  });

  it("makes portable snapshots the default and live tokens explicit", () => {
    const cwd = mkdtempSync(join(tmpdir(), "kdiagram-no-config-"));
    expect(resolveRenderSettings(parseCommand(["render", "x.kdiagram"]), cwd)).toMatchObject({
      snapshotTheme: true,
      background: "transparent",
    });
    const live = resolveRenderSettings(parseCommand(["render", "x.kdiagram", "--live-theme"]), cwd);
    expect(live.snapshotTheme).toBe(false);
    expect(live.warnings[0]).toContain("unresolved CSS custom properties");
  });

  it("rejects token maps that could escape the generated SVG style", () => {
    const cwd = mkdtempSync(join(tmpdir(), "kdiagram-unsafe-theme-"));
    writeFileSync(
      join(cwd, "kekonic-diagrams.config.json"),
      JSON.stringify({
        version: 1,
        themes: { unsafe: { "--kd-bg": "red;</style><script>alert(1)</script>" } },
      }),
    );
    expect(() => resolveRenderSettings(parseCommand(["render", "x.kdiagram"]), cwd)).toThrow(
      "unsupported CSS syntax",
    );
  });
});
