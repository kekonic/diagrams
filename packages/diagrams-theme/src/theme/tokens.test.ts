import { describe, expect, it } from "vite-plus/test";
import { themeToCss } from "./tokens.ts";

describe("theme CSS", () => {
  it("includes concrete tokens only for portable snapshots", () => {
    expect(themeToCss("light", true)).toContain("--kd-bg:");
    expect(themeToCss("light", false)).not.toContain("--kd-bg:");
    expect(themeToCss("light", false)).toContain(".flow-node-shell");
  });
});
