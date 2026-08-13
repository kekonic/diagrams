import { describe, expect, it } from "vite-plus/test";
import { buildStudioRenderOptions, DEFAULT_STUDIO_PRESENTATION } from "./presentation.ts";

describe("studio presentation controls", () => {
  it("keeps unset controls out of renderer policy", () => {
    expect(buildStudioRenderOptions(DEFAULT_STUDIO_PRESENTATION, "studio-live")).toEqual({
      theme: "studio-live",
      layout: {},
      edges: {},
      debug: { showPorts: false, showBounds: false },
    });
  });

  it("maps layout and edge controls through the shared host-neutral contract", () => {
    expect(
      buildStudioRenderOptions({
        ...DEFAULT_STUDIO_PRESENTATION,
        direction: "LR",
        density: "compact",
        edgeGaps: "wide",
        edgeStyle: "rounded",
        crossings: "smart",
      }),
    ).toMatchObject({
      theme: "dark",
      layout: { direction: "LR", density: "compact", edgeNodeSpacing: 72 },
      edges: { route: "rounded", crossings: "smart" },
    });
  });
});
