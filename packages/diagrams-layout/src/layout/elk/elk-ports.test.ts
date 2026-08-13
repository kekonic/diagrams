import { describe, expect, it } from "vite-plus/test";
import type { GraphModel } from "@kekonic/diagrams-core";
import { measureGraph } from "../../measure/measure.ts";
import { assignEdgePorts, flowEntrySide, flowExitSide, inPortId, outPortId } from "./elk-ports.ts";
import { buildElkGraph } from "./build-elk-graph.ts";
import { layoutAndRouteWithElk } from "./layout-with-elk.ts";

function fanInOutGraph(): GraphModel {
  return {
    id: "hub",
    nodes: [
      { id: "a", label: "A", kind: "service", styleRefs: [] },
      { id: "b", label: "B", kind: "service", styleRefs: [] },
      { id: "c", label: "C", kind: "service", styleRefs: [] },
      { id: "hub", label: "Hub", kind: "service", styleRefs: [] },
      { id: "d", label: "D", kind: "service", styleRefs: [] },
      { id: "e", label: "E", kind: "service", styleRefs: [] },
    ],
    edges: [
      { id: "in1", from: "a", to: "hub", kind: "sync", styleRefs: [] },
      { id: "in2", from: "b", to: "hub", kind: "sync", styleRefs: [] },
      { id: "in3", from: "c", to: "hub", kind: "sync", styleRefs: [] },
      { id: "out1", from: "hub", to: "d", kind: "sync", styleRefs: [] },
      { id: "out2", from: "hub", to: "e", kind: "sync", styleRefs: [] },
    ],
    groups: [],
    styles: [],
    diagnostics: [],
  };
}

describe("assignEdgePorts", () => {
  it("maps LR exit/entry faces", () => {
    expect(flowExitSide("LR")).toBe("EAST");
    expect(flowEntrySide("LR")).toBe("WEST");
    expect(flowExitSide("TD")).toBe("SOUTH");
    expect(flowEntrySide("TD")).toBe("NORTH");
  });

  it("gives every edge its own out-port and in-port with distinct geometry positions", () => {
    const graph = fanInOutGraph();
    const measured = measureGraph(graph).nodes;
    const assignment = assignEdgePorts(graph, measured, "LR");

    expect(assignment.portedNodes.has("hub")).toBe(true);
    const hubPorts = assignment.portsByNode.get("hub")!;
    const outPorts = hubPorts.filter((p) => p.id.includes(":out:"));
    const inPorts = hubPorts.filter((p) => p.id.includes(":in:"));
    expect(outPorts).toHaveLength(2);
    expect(inPorts).toHaveLength(3);

    // Fan-in pins are vertically separated on the west face.
    const inYs = inPorts.map((p) => p.y!).sort((a, b) => a - b);
    expect(inYs[2]! - inYs[0]!).toBeGreaterThan(8);

    // Fan-out pins are vertically separated on the east face.
    const outYs = outPorts.map((p) => p.y!).sort((a, b) => a - b);
    expect(outYs[1]! - outYs[0]!).toBeGreaterThan(4);

    expect(assignment.edgeSourcePort.get("out1")).toBe(outPortId("hub", "out1"));
    expect(assignment.edgeTargetPort.get("in1")).toBe(inPortId("hub", "in1"));
  });

  it("still creates dedicated ports for degree-1 endpoints", () => {
    const graph: GraphModel = {
      id: "pair",
      nodes: [
        { id: "a", label: "A", kind: "service", styleRefs: [] },
        { id: "b", label: "B", kind: "service", styleRefs: [] },
      ],
      edges: [{ id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] }],
      groups: [],
      styles: [],
      diagnostics: [],
    };
    const measured = measureGraph(graph).nodes;
    const assignment = assignEdgePorts(graph, measured, "LR");
    expect(assignment.edgeSourcePort.get("e1")).toBe(outPortId("a", "e1"));
    expect(assignment.edgeTargetPort.get("e1")).toBe(inPortId("b", "e1"));
    expect(assignment.portsByNode.get("a")).toHaveLength(1);
    expect(assignment.portsByNode.get("b")).toHaveLength(1);
  });

  it("leaves mutual A↔B edges node→node so ELK can free-attach the corridor", () => {
    const graph: GraphModel = {
      id: "ab",
      nodes: [
        { id: "a", label: "A", kind: "service", styleRefs: [] },
        { id: "b", label: "B", kind: "service", styleRefs: [] },
      ],
      edges: [
        { id: "e1", from: "b", to: "a", kind: "sync", styleRefs: [] },
        { id: "e2", from: "a", to: "b", kind: "sync", styleRefs: [] },
      ],
      groups: [],
      styles: [],
      diagnostics: [],
    };
    const measured = measureGraph(graph).nodes;
    const assignment = assignEdgePorts(graph, measured, "LR");
    expect(assignment.edgeSourcePort.size).toBe(0);
    expect(assignment.edgeTargetPort.size).toBe(0);
    expect(assignment.portedNodes.size).toBe(0);
  });
});

describe("buildElkGraph multi-port wiring", () => {
  it("wires every edge port→port with FIXED_POS on both ends", () => {
    const graph = fanInOutGraph();
    const measured = measureGraph(graph).nodes;
    const elk = buildElkGraph(graph, measured, { direction: "LR" });
    const hub = elk.children?.find((c) => c.id === "hub");
    expect(hub?.layoutOptions?.["elk.portConstraints"]).toBe("FIXED_POS");
    expect(hub?.ports?.length).toBe(5);

    for (const edge of elk.edges ?? []) {
      expect(edge.sources[0]).toMatch(/:out:/);
      expect(edge.targets[0]).toMatch(/:in:/);
    }
    const sourcePins = new Set((elk.edges ?? []).map((e) => e.sources[0]));
    const targetPins = new Set((elk.edges ?? []).map((e) => e.targets[0]));
    expect(sourcePins.size).toBe(5);
    expect(targetPins.size).toBe(5);
  });

  it("keeps fan-in attach points separated after layout + silhouette snap", async () => {
    const graph = fanInOutGraph();
    const measured = measureGraph(graph).nodes;
    const { layout } = await layoutAndRouteWithElk(graph, measured, { direction: "LR" });
    const hub = layout.nodes.find((n) => n.nodeId === "hub")!;
    const inbound = layout.edgePaths.filter((p) => ["in1", "in2", "in3"].includes(p.edgeId));
    expect(inbound).toHaveLength(3);
    const attachYs = inbound.map((p) => p.points[p.points.length - 1]!.y).sort((a, b) => a - b);
    expect(attachYs[2]! - attachYs[0]!).toBeGreaterThan(8);
    for (const y of attachYs) {
      expect(y).toBeGreaterThanOrEqual(hub.bounds.y - 2);
      expect(y).toBeLessThanOrEqual(hub.bounds.y + hub.bounds.height + 2);
    }
  });

  it("layouts compound groups with port→port edges (incoming FIXED_POS)", async () => {
    const graph: GraphModel = {
      id: "compound-ports",
      nodes: [
        { id: "a", label: "A", kind: "service", styleRefs: [], groupId: "g1" },
        { id: "b", label: "B", kind: "service", styleRefs: [], groupId: "g1" },
        { id: "c", label: "C", kind: "service", styleRefs: [], groupId: "g1" },
      ],
      edges: [
        { id: "e1", from: "a", to: "c", kind: "sync", styleRefs: [] },
        { id: "e2", from: "b", to: "c", kind: "sync", styleRefs: [] },
      ],
      groups: [
        {
          id: "g1",
          label: "Box",
          kind: "group",
          nodeIds: ["a", "b", "c"],
          childGroupIds: [],
          styleRefs: [],
        },
      ],
      styles: [],
      diagnostics: [],
    };
    const measured = measureGraph(graph).nodes;
    const elk = buildElkGraph(graph, measured, { direction: "LR", groupLayout: "compound" });
    expect(elk.layoutOptions?.["elk.hierarchyHandling"]).toBe("INCLUDE_CHILDREN");
    const { layout } = await layoutAndRouteWithElk(graph, measured, {
      direction: "LR",
      groupLayout: "compound",
    });
    expect(layout.edgePaths).toHaveLength(2);
    for (const path of layout.edgePaths) {
      expect(path.points.length).toBeGreaterThanOrEqual(2);
      for (const p of path.points) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });
});
