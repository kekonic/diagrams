import { describe, expect, it } from "vite-plus/test";
import { finalizePortableSvg } from "./portable-svg.ts";
import type { ResolvedRenderSettings } from "./project-config.ts";

const base: ResolvedRenderSettings = {
  theme: "light",
  snapshotTheme: true,
  background: "transparent",
  embedFonts: false,
  printSafe: false,
  warnings: [],
};

describe("portable SVG finalization", () => {
  it("adds an explicit theme background behind content", () => {
    const svg = '<svg><style>.x{}</style><desc id="d">Diagram</desc><g/></svg>';
    const result = finalizePortableSvg(svg, { ...base, background: "theme" });
    expect(result.indexOf("kdiagram-export-background")).toBeLessThan(result.indexOf("<g/>"));
  });

  it("can embed the bundled measurement font", () => {
    const result = finalizePortableSvg("<svg><style>.x{}</style><desc>D</desc></svg>", {
      ...base,
      embedFonts: true,
    });
    expect(result).toContain('@font-face{font-family:"Inter"');
    expect(result).toContain("data:font/woff;base64,");
  });
});
