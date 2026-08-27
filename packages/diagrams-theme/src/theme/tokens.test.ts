import { describe, expect, it } from "vite-plus/test";
import { THEME_CSS_TOKEN_SELECTORS, themeToCss } from "./tokens.ts";

describe("theme CSS", () => {
  it("does not lock unthemed .k-diagram to dark so inline SVG can inherit :root", () => {
    const darkParts = THEME_CSS_TOKEN_SELECTORS.dark.split(",").map((part) => part.trim());
    expect(darkParts).not.toContain(".k-diagram");
    expect(darkParts).toContain(":root");
    expect(darkParts).toContain(':root[data-theme="dark"]');
    expect(THEME_CSS_TOKEN_SELECTORS.light).toContain(':root[data-theme="light"]');
  });

  it("includes concrete tokens only for portable snapshots", () => {
    expect(themeToCss("light", true)).toContain("--kd-bg:");
    expect(themeToCss("light", false)).not.toContain("--kd-bg:");
    expect(themeToCss("light", false)).toContain(".flow-node-shell");
  });

  it("scopes snapshot tokens to the stamped theme so sibling inline SVGs do not leak", () => {
    const light = themeToCss("light", true);
    expect(light).toMatch(/\.k-diagram\[data-theme="light"\] \{\s*--kd-bg:/);
    expect(light.indexOf('.k-diagram[data-theme="light"]')).toBeLessThan(light.indexOf("--kd-bg:"));
    const custom = themeToCss("acme-paper", true);
    expect(custom).toContain('.k-diagram[data-theme="acme-paper"]');
  });

  it("keeps architecture kinds on the product theme, not a C4 palette", () => {
    const css = themeToCss("light", true);
    // Container matches service — C4 does not require Structurizr fills.
    expect(css).toContain("--kd-service-fill: #f7f2ff");
    expect(css).toContain("--kd-container-fill: #f7f2ff");
    expect(css).not.toContain("--kd-system-fill: #d9ccf8");
    expect(css).not.toContain("--kd-container-fill: #e7defa");
    expect(css).not.toContain("--kd-external-fill: #eef0f3");
    expect(css).not.toContain(".flow-node-container.flow-shape-cylinder");
    expect(css).toContain("--node-stroke-dash: 5 3.5");
  });

  it("defines contrasting label tokens for semantic state fills", () => {
    const dark = themeToCss("dark", true);
    const light = themeToCss("light", true);
    expect(dark).toContain("--kd-on-success:");
    expect(dark).toContain("--node-title-fill: var(--kd-on-success)");
    expect(light).toContain("--kd-on-warning:");
    expect(light).toContain("--node-title-fill: var(--kd-on-warning)");
  });

  it("keeps on-* title colors readable against their node fills", () => {
    const lum = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const token = (css: string, name: string) => {
      const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
      expect(match?.[1], name).toBeTruthy();
      return match![1]!;
    };

    const dark = themeToCss("dark", true);
    expect(lum(token(dark, "--kd-on-success"))).toBeGreaterThan(
      lum(token(dark, "--kd-success-fill")),
    );
    expect(lum(token(dark, "--kd-on-warning"))).toBeGreaterThan(
      lum(token(dark, "--kd-warning-fill")),
    );
    expect(lum(token(dark, "--kd-on-danger"))).toBeGreaterThan(
      lum(token(dark, "--kd-danger-fill")),
    );
    expect(lum(token(dark, "--kd-on-muted"))).toBeGreaterThan(
      lum(token(dark, "--kd-surface")) + 40,
    );

    const light = themeToCss("light", true);
    expect(lum(token(light, "--kd-on-success"))).toBeLessThan(
      lum(token(light, "--kd-success-fill")),
    );
    expect(lum(token(light, "--kd-on-warning"))).toBeLessThan(
      lum(token(light, "--kd-warning-fill")),
    );
    expect(lum(token(light, "--kd-on-danger"))).toBeLessThan(lum(token(light, "--kd-danger-fill")));
    expect(lum(token(light, "--kd-on-muted"))).toBeLessThan(lum(token(light, "--kd-surface")) - 40);
  });

  it("paints swimlane header chrome, not just pointer-events", () => {
    const css = themeToCss("dark", false);
    expect(css).toContain(".flow-group-header-bar { fill:");
    expect(css).toContain(".flow-group-header-rule { stroke:");
    expect(css).toContain(".flow-group-swimlane-sep { stroke:");
    expect(css).not.toContain(".flow-group-header-accent");
    expect(css).not.toContain(".flow-group-swimlane .flow-group-box");
    expect(css).toContain(".flow-group-box { fill: none;");
    expect(css).toContain(".flow-group-accented .flow-group-box { fill: var(--kd-group-fill); }");
  });
});
