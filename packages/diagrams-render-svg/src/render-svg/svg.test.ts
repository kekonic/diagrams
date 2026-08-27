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
    expect(hex).toContain('class="flow-group-box" fill="none"');

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

  it("paints swimlane headers without a dashed lane box", () => {
    const employee = {
      groupId: "employee",
      bounds: { x: 0, y: 0, width: 400, height: 100 },
      headerBox: { x: 0, y: 0, width: 128, height: 100 },
    };
    const manager = {
      groupId: "manager",
      bounds: { x: 0, y: 100, width: 400, height: 120 },
      headerBox: { x: 0, y: 100, width: 128, height: 120 },
    };
    const lane = (id: string, label: string) => ({
      id,
      label,
      kind: "swimlane" as const,
      nodeIds: [] as string[],
      childGroupIds: [] as string[],
      members: [] as never[],
      styleRefs: [] as string[],
    });
    const svg = renderSvg({
      graph: {
        id: "lanes",
        nodes: [],
        edges: [],
        groups: [lane("employee", "Employee"), lane("manager", "Manager")],
        styles: [],
        diagnostics: [],
      },
      layout: {
        ...emptyLayout([employee, manager]),
        groups: emptyLayout([employee, manager]).groups.map((group, index) => ({
          ...group,
          headerBox: index === 0 ? employee.headerBox : manager.headerBox,
        })),
      },
      measured: [],
      treatedEdges: [],
      labels: [],
      options: { theme: "dark" },
      routingOptions: { route: "orthogonal", arrowheads: true },
    });
    expect(svg).toContain("flow-group-swimlane");
    expect(svg).toContain("flow-group-header-bar");
    expect(svg).toContain("flow-group-swimlane-sep");
    expect(svg).not.toMatch(/flow-group-swimlane[\s\S]*?class="flow-group-box"/);
    expect(svg).not.toContain('stroke-dasharray="7 5"');
  });

  it("does not fill ordinary groups, so nested boxes do not stack washes", () => {
    const bounds = { x: 10, y: 20, width: 120, height: 100 };
    const svg = renderSvg({
      graph: {
        id: "rect-group",
        nodes: [],
        edges: [],
        groups: [
          {
            id: "g",
            label: "Communications",
            kind: "group",
            nodeIds: [],
            childGroupIds: [],
            members: [],
            styleRefs: [],
          },
        ],
        styles: [],
        diagnostics: [],
      },
      layout: emptyLayout([{ groupId: "g", bounds }]),
      measured: [],
      treatedEdges: [],
      labels: [],
      options: { theme: "dark" },
      routingOptions: { route: "orthogonal", arrowheads: true },
    });
    expect(svg).toContain('class="flow-group-box" fill="none"');
    expect(svg).toContain('class="flow-group" data-group-id="g"');
    expect(svg).not.toContain('class="flow-group flow-group-accented"');
  });

  it("omits theme lock attributes when theme is auto so the host can inherit", () => {
    const svg = renderSvg({
      graph: {
        id: "inherit",
        nodes: [],
        edges: [],
        groups: [],
        styles: [],
        diagnostics: [],
      },
      layout: emptyLayout(),
      measured: [],
      treatedEdges: [],
      labels: [],
      options: { theme: "auto", snapshotTheme: true },
      routingOptions: { route: "orthogonal", arrowheads: true },
    });
    expect(svg).toContain('class="k-diagram"');
    expect(svg).not.toContain("kdiagram-theme-");
    expect(svg).not.toContain("data-theme=");
    expect(svg).not.toContain("--kd-bg:");
  });
});

describe("renderSvg state-machine finals", () => {
  const bounds = { x: 10, y: 20, width: 72, height: 72 };

  function renderFinal(labelAuthored: boolean, label: string) {
    return renderSvg({
      graph: {
        id: "state",
        nodes: [
          {
            id: "done",
            label,
            labelAuthored,
            kind: "final",
            shape: "circle",
            styleRefs: [],
          },
        ],
        edges: [],
        groups: [],
        styles: [],
        diagnostics: [],
      },
      layout: {
        ...emptyLayout(),
        nodes: [{ nodeId: "done", bounds, rank: 0, order: 0 }],
        width: 200,
        height: 160,
      },
      measured: [
        {
          nodeId: "done",
          width: bounds.width,
          height: bounds.height,
          contentBox: { x: 16, y: 16, width: 40, height: 40 },
          labelLines: [label],
        },
      ],
      treatedEdges: [],
      labels: [],
      options: { theme: "dark" },
      routingOptions: { route: "orthogonal", arrowheads: true },
    });
  }

  it("paints a hollow inner ring so authored final names sit on the node fill", () => {
    const svg = renderFinal(true, "Cancelled");
    expect(svg).toContain("flow-state-final-ring");
    expect(svg).toContain(">Cancelled</text>");
    expect(svg).not.toContain("flow-state-final-core");
  });

  it("keeps an unlabeled final as a solid UML bullseye without an id caption", () => {
    const svg = renderFinal(false, "done");
    expect(svg).toContain("flow-state-final-core");
    expect(svg).not.toContain("flow-state-final-ring");
    expect(svg).not.toContain(">done</text>");
  });
});
