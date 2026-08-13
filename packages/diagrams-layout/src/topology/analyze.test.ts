import { describe, expect, it } from "vite-plus/test";
import type { GraphModel } from "@kekonic/diagrams-core";
import { analyzeDiagramTopology, incomingCount, outgoingCount, isChoiceBranch } from "./analyze.ts";

function graph(overrides: Partial<GraphModel> = {}): GraphModel {
  return {
    id: "test",
    nodes: [],
    edges: [],
    groups: [],
    styles: [],
    diagnostics: [],
    ...overrides,
  };
}

describe("analyzeDiagramTopology", () => {
  it("counts incoming and outgoing edges per node", () => {
    const g = graph({
      nodes: [
        { id: "a", label: "A", kind: "service", styleRefs: [] },
        { id: "b", label: "B", kind: "service", styleRefs: [] },
        { id: "c", label: "C", kind: "service", styleRefs: [] },
      ],
      edges: [
        { id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] },
        { id: "e2", from: "a", to: "c", kind: "sync", styleRefs: [] },
        { id: "e3", from: "b", to: "c", kind: "sync", styleRefs: [] },
      ],
    });

    const topo = analyzeDiagramTopology(g, "LR");
    expect(outgoingCount(topo, "a")).toBe(2);
    expect(incomingCount(topo, "c")).toBe(2);
    expect(topo.fanOutNodes).toContain("a");
    expect(topo.mergeNodes).toContain("c");
  });

  it("identifies choice nodes with two or more outgoing edges", () => {
    const g = graph({
      nodes: [
        { id: "pick", label: "Pick", kind: "choice", styleRefs: [] },
        { id: "yes", label: "Yes", kind: "service", styleRefs: [] },
        { id: "no", label: "No", kind: "service", styleRefs: [] },
      ],
      edges: [
        { id: "e1", from: "pick", to: "yes", kind: "sync", styleRefs: [] },
        { id: "e2", from: "pick", to: "no", kind: "sync", styleRefs: [] },
      ],
    });

    const topo = analyzeDiagramTopology(g, "TD");
    expect(topo.choiceNodes).toEqual(["pick"]);
    expect(isChoiceBranch(topo, "pick")).toBe(true);
    expect(topo.isWorkflowTD).toBe(true);
  });

  it("does not mark LR choice diagrams as workflow TD", () => {
    const g = graph({
      nodes: [
        { id: "pick", label: "Pick", kind: "choice", styleRefs: [] },
        { id: "a", label: "A", kind: "service", styleRefs: [] },
        { id: "b", label: "B", kind: "service", styleRefs: [] },
      ],
      edges: [
        { id: "e1", from: "pick", to: "a", kind: "sync", styleRefs: [] },
        { id: "e2", from: "pick", to: "b", kind: "sync", styleRefs: [] },
      ],
    });

    const topo = analyzeDiagramTopology(g, "LR");
    expect(topo.isWorkflowTD).toBe(false);
  });
});
