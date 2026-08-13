import { describe, expect, it } from "vite-plus/test";
import {
  renderPipeline,
  routeFromLayout,
  layoutFromGraph,
  compileSource,
} from "./pipeline/render.ts";
import { renderSvg } from "@kekonic/diagrams-render-svg";

function countMarkerEndsPerEdge(svg: string): Map<string, number> {
  const counts = new Map<string, number>();
  const re = /<g class="[^"]*" data-edge-id="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g;
  for (const match of svg.matchAll(re)) {
    const edgeId = match[1]!;
    const groupBody = match[2]!;
    if (!groupBody.includes("flow-edge-path")) continue;
    counts.set(edgeId, (groupBody.match(/marker-end=/g) ?? []).length);
  }
  return counts;
}

const FANOUT = `diagram "Fanout" {
  direction LR
  a: service "A"
  b: service "B"
  c: service "C"
  d: service "D"
  a -> b
  a -> c
  a -> d
}
`;

async function treatedEdgesForFixture(source: string) {
  const compiled = compileSource(source);
  const layout = await layoutFromGraph(compiled.graph, compiled.layoutHints);
  const routed = routeFromLayout(compiled.graph, layout, compiled.routingHints);
  return routed.treatedEdges;
}

describe("edge arrowhead markers", () => {
  it("fanout treated edges have line segments", async () => {
    const treated = await treatedEdgesForFixture(FANOUT);
    expect(treated.length).toBeGreaterThan(0);
    expect(treated.every((e) => e.segments.some((s) => s.type === "line"))).toBe(true);
  });

  it("applies marker-end once per directed edge", async () => {
    const result = await renderPipeline(FANOUT);
    expect(result.ok).toBe(true);

    const counts = countMarkerEndsPerEdge(result.svg!);
    for (const [edgeId, markerCount] of counts) {
      expect(markerCount, `edge ${edgeId} should have exactly one marker-end`).toBe(1);
    }
  });

  it("orthogonal multi-segment edge renders one marker-end on last line run only", async () => {
    const treated = [
      {
        edgeId: "e1",
        segments: [
          { type: "line" as const, from: { x: 0, y: 0 }, to: { x: 100, y: 0 } },
          { type: "line" as const, from: { x: 100, y: 0 }, to: { x: 100, y: 80 } },
          { type: "line" as const, from: { x: 100, y: 80 }, to: { x: 200, y: 80 } },
        ],
      },
    ];
    const svg = renderSvg({
      graph: {
        id: "t",
        nodes: [],
        edges: [{ id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] }],
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
        algorithmVersion: "elk-layered-v1",
        layoutMs: 0,
        width: 220,
        height: 120,
      },
      measured: [],
      treatedEdges: treated,
      labels: [],
      options: { theme: "dark" },
      routingOptions: { route: "orthogonal", arrowheads: true },
    });

    const group = svg.match(/data-edge-id="e1"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? "";
    expect((group.match(/marker-end=/g) ?? []).length).toBe(1);
    expect((group.match(/flow-edge-path/g) ?? []).length).toBe(1);
  });

  it("gap-split edge renders marker-end only on terminal line run", async () => {
    const svg = renderSvg({
      graph: {
        id: "t",
        nodes: [],
        edges: [{ id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] }],
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
        algorithmVersion: "elk-layered-v1",
        layoutMs: 0,
        width: 220,
        height: 120,
      },
      measured: [],
      treatedEdges: [
        {
          edgeId: "e1",
          segments: [
            { type: "line", from: { x: 0, y: 0 }, to: { x: 80, y: 0 } },
            { type: "gap", from: { x: 80, y: 0 }, to: { x: 90, y: 0 } },
            { type: "line", from: { x: 90, y: 0 }, to: { x: 90, y: 60 } },
            { type: "gap", from: { x: 90, y: 60 }, to: { x: 90, y: 70 } },
            { type: "line", from: { x: 90, y: 70 }, to: { x: 180, y: 70 } },
          ],
        },
      ],
      labels: [],
      options: { theme: "dark" },
      routingOptions: { route: "orthogonal", arrowheads: true },
    });

    const group = svg.match(/data-edge-id="e1"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? "";
    expect((group.match(/marker-end=/g) ?? []).length).toBe(1);
    expect((group.match(/flow-edge-path/g) ?? []).length).toBe(3);
  });
});
