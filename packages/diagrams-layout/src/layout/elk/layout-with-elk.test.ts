import { describe, expect, it } from "vite-plus/test";
import type { GraphModel } from "@kekonic/diagrams-core";
import { measureGraph } from "../../measure/measure.ts";
import { layoutAndRouteWithElk } from "./layout-with-elk.ts";
import { buildElkGraph } from "./build-elk-graph.ts";

function simpleGraph(): GraphModel {
  return {
    id: "elk",
    nodes: [
      { id: "a", label: "A", kind: "service", styleRefs: [] },
      { id: "b", label: "B", kind: "service", styleRefs: [] },
      { id: "c", label: "C", kind: "service", styleRefs: [] },
    ],
    edges: [
      { id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] },
      { id: "e2", from: "a", to: "c", kind: "sync", styleRefs: [] },
    ],
    groups: [],
    styles: [],
    diagnostics: [],
  };
}

function groupedGraph(): GraphModel {
  return {
    id: "groups",
    nodes: [
      { id: "a", label: "A", kind: "service", styleRefs: [] },
      { id: "b", label: "B", kind: "service", styleRefs: [] },
    ],
    edges: [{ id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] }],
    groups: [
      {
        id: "g1",
        label: "Box",
        kind: "group",
        nodeIds: ["a", "b"],
        childGroupIds: [],
        styleRefs: [],
      },
    ],
    styles: [],
    diagnostics: [],
  };
}

describe("layoutAndRouteWithElk", () => {
  it("returns node bounds and orthogonal edge paths together", async () => {
    const graph = simpleGraph();
    const measured = measureGraph(graph).nodes;
    const { layout, edges } = await layoutAndRouteWithElk(graph, measured, { direction: "LR" });

    expect(layout.algorithmVersion).toBe("elk-layered-v1");
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edgePaths).toHaveLength(2);
    expect(edges).toEqual(layout.edgePaths);
    for (const path of layout.edgePaths) {
      expect(path.points.length).toBeGreaterThanOrEqual(2);
    }
    const a = layout.nodes.find((n) => n.nodeId === "a")!;
    const b = layout.nodes.find((n) => n.nodeId === "b")!;
    expect(a.bounds.x).toBeLessThan(b.bounds.x);
  });

  it("keeps simple labeled LR edges straight (no ELK label-pocket bump)", async () => {
    const graph: GraphModel = {
      id: "hello",
      nodes: [
        { id: "api", label: "API", kind: "gateway", styleRefs: [] },
        { id: "db", label: "Postgres", kind: "database", styleRefs: [] },
      ],
      edges: [{ id: "e1", from: "api", to: "db", label: "query", kind: "sync", styleRefs: [] }],
      groups: [],
      styles: [],
      diagnostics: [],
    };
    const measured = measureGraph(graph).nodes;
    const { layout } = await layoutAndRouteWithElk(graph, measured, { direction: "LR" });
    const path = layout.edgePaths[0]!;
    // Two collinear ports → a single straight segment (start + end). A 6-point
    // rectangular jog was the old ELK inline-label failure mode.
    expect(path.points).toHaveLength(2);
    expect(Math.abs(path.points[0]!.y - path.points[1]!.y)).toBeLessThan(1);
    // Labels are placed post-layout by KDiagram, not as ELK edge labels.
    expect(layout.edgeLabels).toHaveLength(0);
  });

  it("lays out nested group children with absolute coordinates", async () => {
    const graph = groupedGraph();
    const measured = measureGraph(graph).nodes;
    const { layout } = await layoutAndRouteWithElk(graph, measured, {
      direction: "LR",
      groupLayout: "compound",
    });

    expect(layout.groups).toHaveLength(1);
    expect(layout.groups[0]!.bounds.width).toBeGreaterThan(0);
    expect(layout.edgePaths[0]!.points.length).toBeGreaterThanOrEqual(2);
    for (const p of layout.edgePaths[0]!.points) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("absolute-izes intra-group edge sections relative to the compound LCA", async () => {
    const graph = groupedGraph();
    const measured = measureGraph(graph).nodes;
    const { layout } = await layoutAndRouteWithElk(graph, measured, {
      direction: "LR",
      groupLayout: "compound",
    });

    const a = layout.nodes.find((n) => n.nodeId === "a")!;
    const b = layout.nodes.find((n) => n.nodeId === "b")!;
    const path = layout.edgePaths[0]!;
    const start = path.points[0]!;
    const end = path.points[path.points.length - 1]!;

    const nearBox = (p: { x: number; y: number }, box: (typeof a)["bounds"], slack = 2) => {
      const onX = p.x >= box.x - slack && p.x <= box.x + box.width + slack;
      const onY = p.y >= box.y - slack && p.y <= box.y + box.height + slack;
      const onEdge =
        Math.abs(p.x - box.x) <= slack ||
        Math.abs(p.x - (box.x + box.width)) <= slack ||
        Math.abs(p.y - box.y) <= slack ||
        Math.abs(p.y - (box.y + box.height)) <= slack;
      return onX && onY && onEdge;
    };

    expect(nearBox(start, a.bounds)).toBe(true);
    expect(nearBox(end, b.bounds)).toBe(true);
  });

  it("applies designer defaults for layered flowcharts", () => {
    const graph = simpleGraph();
    const measured = measureGraph(graph).nodes;
    const elk = buildElkGraph(graph, measured, { direction: "TD" });
    expect(elk.layoutOptions?.["elk.layered.nodePlacement.strategy"]).toBe("NETWORK_SIMPLEX");
    expect(elk.layoutOptions?.["elk.layered.compaction.postCompaction.strategy"]).toBe(
      "EDGE_LENGTH",
    );
    expect(elk.layoutOptions?.["elk.layered.thoroughness"]).toBe("24");
    expect(elk.layoutOptions?.["elk.layered.unnecessaryBendpoints"]).toBe("false");
    expect(elk.edges?.[0]?.labels).toBeUndefined();
    expect(elk.edges?.[0]?.layoutOptions?.["elk.layered.priority.straightness"]).toBeTruthy();
  });

  it("maps flat groupLayout to a flat ELK tree (no nested group nodes)", () => {
    const graph = groupedGraph();
    const measured = measureGraph(graph).nodes;
    const elk = buildElkGraph(graph, measured, { direction: "LR", groupLayout: "flat" });
    expect(elk.layoutOptions?.["elk.hierarchyHandling"]).toBe("SEPARATE_CHILDREN");
    expect(elk.children?.some((c) => c.id.startsWith("group:"))).toBe(false);
    expect(elk.children?.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("emits FIXED_POS geometry ports on choice nodes and wires edges to them", () => {
    const graph: GraphModel = {
      id: "choice",
      nodes: [
        { id: "q", label: "Q?", kind: "choice", styleRefs: [] },
        { id: "y", label: "Yes path", kind: "service", styleRefs: [] },
        { id: "n", label: "No path", kind: "service", styleRefs: [] },
      ],
      edges: [
        { id: "e1", from: "q", to: "y", label: "Yes", kind: "sync", styleRefs: [], branch: "yes" },
        { id: "e2", from: "q", to: "n", label: "No", kind: "sync", styleRefs: [], branch: "no" },
      ],
      groups: [],
      styles: [],
      diagnostics: [],
    };
    const measured = measureGraph(graph).nodes;
    const elk = buildElkGraph(graph, measured, { direction: "TD" });
    const q = elk.children?.find((c) => c.id === "q");
    expect(q?.layoutOptions?.["elk.portConstraints"]).toBe("FIXED_POS");
    expect(q?.ports?.map((p) => p.id).sort()).toEqual(["q:out:e1", "q:out:e2"]);
    expect(q?.ports?.every((p) => typeof p.x === "number" && typeof p.y === "number")).toBe(true);
    // Both branches leave on the flow-forward face; indices + geometry positions separate yes/no.
    expect(q?.ports?.find((p) => p.id === "q:out:e1")?.layoutOptions?.["elk.port.side"]).toBe(
      "SOUTH",
    );
    expect(q?.ports?.find((p) => p.id === "q:out:e2")?.layoutOptions?.["elk.port.side"]).toBe(
      "SOUTH",
    );
    expect(elk.edges?.find((e) => e.id === "e1")?.sources).toEqual(["q:out:e1"]);
    expect(elk.edges?.find((e) => e.id === "e1")?.targets).toEqual(["y:in:e1"]);
    expect(elk.edges?.find((e) => e.id === "e2")?.sources).toEqual(["q:out:e2"]);
    expect(elk.edges?.find((e) => e.id === "e2")?.targets).toEqual(["n:in:e2"]);
  });

  it("gives each fan-out edge its own port so exits do not share a pin", () => {
    const graph: GraphModel = {
      id: "fanout",
      nodes: [
        { id: "hub", label: "Hub", kind: "service", styleRefs: [] },
        { id: "a", label: "A", kind: "service", styleRefs: [] },
        { id: "b", label: "B", kind: "service", styleRefs: [] },
        { id: "c", label: "C", kind: "service", styleRefs: [] },
      ],
      edges: [
        { id: "e1", from: "hub", to: "a", kind: "sync", styleRefs: [] },
        { id: "e2", from: "hub", to: "b", kind: "sync", styleRefs: [] },
        { id: "e3", from: "hub", to: "c", kind: "sync", styleRefs: [] },
      ],
      groups: [],
      styles: [],
      diagnostics: [],
    };
    const measured = measureGraph(graph).nodes;
    const elk = buildElkGraph(graph, measured, { direction: "LR" });
    const hub = elk.children?.find((c) => c.id === "hub");
    expect(
      hub?.ports
        ?.filter((p) => p.id.includes(":out:"))
        .map((p) => p.id)
        .sort(),
    ).toEqual(["hub:out:e1", "hub:out:e2", "hub:out:e3"]);
    expect(new Set(elk.edges?.map((e) => e.sources[0])).size).toBe(3);
    expect(new Set(elk.edges?.map((e) => e.targets[0])).size).toBe(3);
  });

  it("activates ELK partitioning for swimlane groups", () => {
    const graph: GraphModel = {
      id: "lanes",
      nodes: [
        { id: "a", label: "A", kind: "service", styleRefs: [], groupId: "lane1" },
        { id: "b", label: "B", kind: "service", styleRefs: [], groupId: "lane2" },
      ],
      edges: [{ id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] }],
      groups: [
        {
          id: "lane1",
          label: "Lane 1",
          kind: "swimlane",
          nodeIds: ["a"],
          childGroupIds: [],
          styleRefs: [],
        },
        {
          id: "lane2",
          label: "Lane 2",
          kind: "swimlane",
          nodeIds: ["b"],
          childGroupIds: [],
          styleRefs: [],
        },
      ],
      styles: [],
      diagnostics: [],
    };
    const measured = measureGraph(graph).nodes;
    const elk = buildElkGraph(graph, measured, { direction: "LR", groupLayout: "swimlane" });
    expect(elk.layoutOptions?.["elk.partitioning.activate"]).toBe("true");
    const a = elk.children?.find((c) => c.id === "a");
    const b = elk.children?.find((c) => c.id === "b");
    expect(a?.layoutOptions?.["elk.partitioning.partition"]).toBe("0");
    expect(b?.layoutOptions?.["elk.partitioning.partition"]).toBe("1");
  });

  it("keeps choice-port layouts attachable after absoluteization", async () => {
    const graph: GraphModel = {
      id: "choice-layout",
      nodes: [
        { id: "q", label: "Q?", kind: "choice", styleRefs: [] },
        { id: "y", label: "Yes", kind: "service", styleRefs: [] },
        { id: "n", label: "No", kind: "service", styleRefs: [] },
      ],
      edges: [
        { id: "e1", from: "q", to: "y", label: "Yes", kind: "sync", styleRefs: [], branch: "yes" },
        { id: "e2", from: "q", to: "n", label: "No", kind: "sync", styleRefs: [], branch: "no" },
      ],
      groups: [],
      styles: [],
      diagnostics: [],
    };
    const measured = measureGraph(graph).nodes;
    const { layout } = await layoutAndRouteWithElk(graph, measured, { direction: "TD" });
    expect(layout.edgePaths).toHaveLength(2);
    for (const path of layout.edgePaths) {
      expect(path.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
    }
  });

  it("keeps TD policy-fork routes within a bend budget (no side-exit Z/U-turns)", async () => {
    // Mirrors website `workflowBranchKinds` / studio "Policy fork".
    const graph: GraphModel = {
      id: "policy-fork",
      nodes: [
        { id: "start", label: "Submit request", kind: "user", styleRefs: [] },
        { id: "check", label: "Within policy?", kind: "choice", styleRefs: [] },
        { id: "auto", label: "Auto-approve", kind: "success", styleRefs: [] },
        { id: "review", label: "Manual review", kind: "warning", styleRefs: [] },
        { id: "pay", label: "Payment", kind: "service", styleRefs: [] },
        { id: "denied", label: "Notify customer", kind: "warning", styleRefs: [] },
        { id: "done", label: "RefundIssued", kind: "event", styleRefs: [] },
      ],
      edges: [
        { id: "e0", from: "start", to: "check", kind: "sync", styleRefs: [] },
        {
          id: "e1",
          from: "check",
          to: "auto",
          label: "yes",
          kind: "sync",
          styleRefs: [],
          branch: "yes",
        },
        {
          id: "e2",
          from: "check",
          to: "review",
          label: "no",
          kind: "sync",
          styleRefs: [],
          branch: "no",
        },
        { id: "e3", from: "auto", to: "pay", kind: "sync", styleRefs: [] },
        {
          id: "e4",
          from: "review",
          to: "pay",
          label: "approve",
          kind: "sync",
          styleRefs: [],
          branch: "yes",
        },
        {
          id: "e5",
          from: "review",
          to: "denied",
          label: "reject",
          kind: "failure",
          styleRefs: [],
          branch: "no",
        },
        { id: "e6", from: "pay", to: "done", kind: "async", styleRefs: [] },
      ],
      groups: [],
      styles: [],
      diagnostics: [],
    };

    const bendCount = (points: { x: number; y: number }[]): number => {
      let bends = 0;
      for (let i = 1; i < points.length - 1; i++) {
        const a = points[i - 1]!;
        const b = points[i]!;
        const c = points[i + 1]!;
        const d1 = Math.abs(a.x - b.x) < 0.75 ? "V" : "H";
        const d2 = Math.abs(b.x - c.x) < 0.75 ? "V" : "H";
        if (d1 !== d2) bends++;
      }
      return bends;
    };

    const measured = measureGraph(graph).nodes;
    const { edges } = await layoutAndRouteWithElk(graph, measured, {
      direction: "TD",
      density: "normal",
    });

    const byId = new Map(edges.map((p) => [p.edgeId, p]));
    // Side-exit "no" ports used to force 3-bend Z-paths on these edges.
    expect(bendCount(byId.get("e2")!.points)).toBeLessThanOrEqual(2);
    expect(bendCount(byId.get("e4")!.points)).toBeLessThanOrEqual(2);
    expect(bendCount(byId.get("e5")!.points)).toBeLessThanOrEqual(2);

    const totalBends = edges.reduce((sum, p) => sum + bendCount(p.points), 0);
    expect(totalBends).toBeLessThanOrEqual(14);
  });
});
