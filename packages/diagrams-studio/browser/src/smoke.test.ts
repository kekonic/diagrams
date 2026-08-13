import { describe, expect, it } from "vite-plus/test";
import { KDiagram, registerTheme } from "@kekonic/diagrams";
import {
  buildExportOptions,
  buildRenderOptions,
  DEFAULT_OPTIONS,
  type StudioOptions,
} from "./lib/buildRenderOptions.ts";
import {
  defaultSeeds,
  deriveChromeTokens,
  deriveThemeTokens,
  LIVE_THEME_NAME,
  normalizeSeeds,
  seedsForModeToggle,
} from "./lib/deriveTheme.ts";
import { STARTER } from "./lib/examples.ts";
import { EXAMPLES } from "./lib/examples.ts";

describe("studio smoke", () => {
  it("renders a minimal diagram via KDiagram API", async () => {
    registerTheme(LIVE_THEME_NAME, deriveThemeTokens(defaultSeeds("dark")));
    const result = await KDiagram.renderToSvg(STARTER, { theme: LIVE_THEME_NAME });
    expect(result.ok).toBe(true);
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain('data-node-id="a"');
  });

  it("embeds the selected Studio palette in portable SVG output", async () => {
    registerTheme(LIVE_THEME_NAME, deriveThemeTokens(defaultSeeds("light")));
    const result = await KDiagram.renderToSvg(
      STARTER,
      buildExportOptions({ ...DEFAULT_OPTIONS, theme: "light" }),
    );
    expect(result.ok).toBe(true);
    expect(result.svg).toContain("<style>");
    expect(result.svg).toContain("--kd-bg:");
  });

  it("loads example diagrams from the repo", () => {
    expect(EXAMPLES.length).toBeGreaterThan(0);
    expect(EXAMPLES.some((e) => e.id.includes("checkout"))).toBe(true);
  });
});

describe("buildRenderOptions", () => {
  it("omits unset layout overrides (from source)", () => {
    const opts = buildRenderOptions(DEFAULT_OPTIONS);
    expect(opts.layout).toEqual({});
    expect(opts.theme).toBe(LIVE_THEME_NAME);
    expect(opts.edges).toEqual({});
    expect(opts.debug).toEqual({ showPorts: false, showBounds: false });
  });

  it("maps edge gap presets into layout spacing", () => {
    const options: StudioOptions = {
      ...DEFAULT_OPTIONS,
      edgeGaps: "tight",
      direction: "LR",
      spacingScale: 1.2,
      modelOrder: "on",
    };
    const opts = buildRenderOptions(options);
    expect(opts.layout?.direction).toBe("LR");
    expect(opts.layout?.spacingScale).toBe(1.2);
    expect(opts.layout?.considerModelOrder).toBe(true);
    expect(opts.layout?.edgeNodeSpacing).toBe(28);
    expect(opts.layout?.edgeEdgeSpacing).toBe(14);
    expect(opts.layout?.edgeLabelSpacing).toBe(10);
  });

  it("snapshots the active palette for portable SVG exports", () => {
    expect(buildExportOptions({ ...DEFAULT_OPTIONS, theme: "light" })).toMatchObject({
      theme: LIVE_THEME_NAME,
      snapshotTheme: true,
    });
  });
});

describe("deriveThemeTokens", () => {
  it("derives surfaces and accent from accent + neutral seeds", () => {
    const tokens = deriveThemeTokens({
      mode: "dark",
      accent: "#ff4d6d",
      neutral: "#0a0a12",
    });
    expect(tokens["--kd-accent"]).toBe("#ff4d6d");
    expect(tokens["--kd-bg"]).toMatch(/^#/);
    expect(tokens["--kd-surface"]).toMatch(/^#/);
    expect(tokens["--kd-table-fill"]).toBe(tokens["--kd-surface"]);
    expect(tokens["--kd-service-stroke"]).toBe("#ff4d6d");
    expect(tokens["--kd-group-fill"]).toContain("rgba");
  });
});

describe("seedsForModeToggle", () => {
  it("remaps custom neutral into the target mode lightness", () => {
    const next = seedsForModeToggle(
      { mode: "dark", accent: "#ff4d6d", neutral: "#111122" },
      "light",
    );
    expect(next.mode).toBe("light");
    // Custom accent hue is kept; lightness may shift for the new mode.
    expect(next.accent.toLowerCase()).not.toBe(defaultSeeds("light").accent.toLowerCase());
    expect(next.neutral).not.toBe("#111122");
    const chrome = deriveChromeTokens(next);
    expect(chrome["--bg"]).toMatch(/oklch\(\s*9\d/);
  });

  it("swaps default accent and neutral when still mode defaults", () => {
    const dark = defaultSeeds("dark");
    const light = defaultSeeds("light");
    const next = seedsForModeToggle(dark, "light");
    expect(next.accent).toBe(light.accent);
    expect(next.neutral).toBe(light.neutral);
  });

  it("fills missing theme seeds from the selected mode", () => {
    const next = normalizeSeeds("dark", { accent: "#abcabc" });
    expect(next.neutral).toBe(defaultSeeds("dark").neutral);
    expect(next.accent).toBe("#abcabc");
  });

  it("honors mode over a mismatched neutral lightness when deriving chrome", () => {
    const chrome = deriveChromeTokens({
      mode: "light",
      accent: "#336699",
      neutral: "#0a0a12",
    });
    // oklch lightness for light bg should be high
    expect(chrome["--bg"]).toMatch(/oklch\(\s*9\d/);
  });
});
