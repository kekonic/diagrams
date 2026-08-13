import { describe, expect, it } from "vite-plus/test";
import { renderSvg } from "./svg.ts";

describe("renderSvg edge markers", () => {
  it("renders an arrowhead for a directed dependency", () => {
    const svg = renderSvg({
      graph: {
        id: "dependency",
        nodes: [],
        edges: [
          {
            id: "e1",
            from: "a",
            to: "b",
            kind: "dependency",
            arrows: "end",
            styleRefs: [],
          },
        ],
        groups: [],
        styles: [],
        diagnostics: [],
      },
      layout: {
        nodes: [],
        groups: [],
        edgePaths: [],
        edgeLabels: [],
        direction: "LR",
        algorithmVersion: "test",
        layoutMs: 0,
        width: 120,
        height: 40,
      },
      measured: [],
      treatedEdges: [
        {
          edgeId: "e1",
          segments: [{ type: "line", from: { x: 0, y: 20 }, to: { x: 100, y: 20 } }],
        },
      ],
      labels: [],
      options: { theme: "dark" },
      routingOptions: { route: "orthogonal", arrowheads: true },
    });

    const edge = svg.match(/data-edge-id="e1"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? "";
    expect((edge.match(/marker-end=/g) ?? []).length).toBe(1);
  });
});
