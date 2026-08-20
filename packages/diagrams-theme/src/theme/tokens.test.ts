import { describe, expect, it } from "vite-plus/test";
import { themeToCss } from "./tokens.ts";

describe("theme CSS", () => {
  it("includes concrete tokens only for portable snapshots", () => {
    expect(themeToCss("light", true)).toContain("--kd-bg:");
    expect(themeToCss("light", false)).not.toContain("--kd-bg:");
    expect(themeToCss("light", false)).toContain(".flow-node-shell");
  });

  it("keeps architecture kinds on the product theme, not a C4 palette", () => {
    const css = themeToCss("light", true);
    // Container matches service — C4 does not require Structurizr fills.
    expect(css).toContain("--kd-service-fill: #f5f0fc");
    expect(css).toContain("--kd-container-fill: #f5f0fc");
    expect(css).not.toContain("--kd-system-fill: #d9ccf8");
    expect(css).not.toContain("--kd-container-fill: #e7defa");
    expect(css).not.toContain("--kd-external-fill: #eef0f3");
    expect(css).not.toContain(".flow-node-container.flow-shape-cylinder");
    expect(css).toContain("--node-stroke-dash: 5 3.5");
  });
});
