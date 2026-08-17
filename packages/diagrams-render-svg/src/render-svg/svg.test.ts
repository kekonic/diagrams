import { describe, expect, it } from "vite-plus/test";
import { renderSvg } from "./svg.ts";

function emptyLayout(
  groups: Array<{
    groupId: string;
    bounds: { x: number; y: number; width: number; height: number };
  }> = [],
) {
  return {
    nodes: [],
    groups: groups.map((group) => ({
      ...group,
      labelBox: {
        x: group.bounds.x + 14,
        y: group.bounds.y + 10,
        width: 80,
        height: 18,
      },
      padding: { top: 28, right: 16, bottom: 16, left: 16 },
    })),
    edgePaths: [],
    edgeLabels: [],
    direction: "LR" as const,
    algorithmVersion: "test",
    layoutMs: 0,
    width: 200,
    height: 160,
  };
}

function chromeGroup(
  id: string,
  shape: "hexagon" | "circle",
  chrome?: boolean,
): {
  id: string;
  label: string;
  kind: "group";
  nodeIds: string[];
  childGroupIds: string[];
  members: [];
  styleRefs: [];
  shape: "hexagon" | "circle";
  chrome?: boolean;
} {
  return {
    id,
    label: id,
    kind: "group",
    nodeIds: [],
    childGroupIds: [],
    members: [],
    styleRefs: [],
    shape,
    ...(chrome === false ? { chrome: false } : {}),
  };
}

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
      layout: emptyLayout(),
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

describe("renderSvg group chrome shapes", () => {
  it("renders hexagon and circle group chrome; chrome:false suppresses outline", () => {
    const bounds = { x: 10, y: 20, width: 120, height: 100 };
    const hex = renderSvg({
      graph: {
        id: "hex",
        nodes: [],
        edges: [],
        groups: [chromeGroup("g", "hexagon")],
        styles: [],
        diagnostics: [],
      },
      layout: emptyLayout([{ groupId: "g", bounds }]),
      measured: [],
      treatedEdges: [],
      labels: [],
      options: { theme: "light" },
      routingOptions: { route: "orthogonal", arrowheads: true },
    });
    expect(hex).toContain('data-group-id="g"');
    expect(hex).toMatch(/<polygon[^>]*class="flow-group-box"/);

    const circle = renderSvg({
      graph: {
        id: "circle",
        nodes: [],
        edges: [],
        groups: [chromeGroup("g", "circle")],
        styles: [],
        diagnostics: [],
      },
      layout: emptyLayout([{ groupId: "g", bounds }]),
      measured: [],
      treatedEdges: [],
      labels: [],
      options: { theme: "light" },
      routingOptions: { route: "orthogonal", arrowheads: true },
    });
    expect(circle).toMatch(/<path[^>]*class="flow-group-box"/);

    const hidden = renderSvg({
      graph: {
        id: "hidden",
        nodes: [],
        edges: [],
        groups: [chromeGroup("g", "hexagon", false)],
        styles: [],
        diagnostics: [],
      },
      layout: emptyLayout([{ groupId: "g", bounds }]),
      measured: [],
      treatedEdges: [],
      labels: [],
      options: { theme: "light" },
      routingOptions: { route: "orthogonal", arrowheads: true },
    });
    expect(hidden).toContain("flow-group-chromeless");
    expect(hidden).not.toMatch(/<(?:rect|polygon|path)[^>]*class="flow-group-box"/);
  });
});
