import { describe, expect, it } from "vite-plus/test";
import type { GraphEdge, GraphModel, GraphNode } from "../types/graph.ts";
import {
  enumerateAutoPaths,
  inferAutoAnimation,
  planAutoWalk,
  traceDeclarationPath,
} from "./infer-auto-animation.ts";

function node(id: string, kind = "service"): GraphNode {
  return { id, label: id, kind, styleRefs: [] };
}

function edge(from: string, to: string, i: number, label?: string): GraphEdge {
  return { id: `e${i}`, from, to, kind: "sync", styleRefs: [], label };
}

function graph(nodes: GraphNode[], edges: GraphEdge[]): GraphModel {
  return { id: "t", nodes, edges, groups: [], styles: [], diagnostics: [], animations: [] };
}

describe("enumerateAutoPaths", () => {
  it("returns empty for empty graph", () => {
    expect(enumerateAutoPaths(graph([], []))).toEqual([]);
  });

  it("returns a single-node path", () => {
    expect(enumerateAutoPaths(graph([node("a")], []))).toEqual([["a"]]);
  });

  it("plays each exclusive choice alternative from the start", () => {
    const g = graph(
      [
        node("request", "user"),
        node("eligible", "choice"),
        node("inspect"),
        node("deny", "warning"),
        node("closed", "success"),
      ],
      [
        edge("request", "eligible", 0),
        edge("eligible", "inspect", 1),
        edge("eligible", "deny", 2),
        edge("inspect", "closed", 3),
        edge("deny", "closed", 4),
      ],
    );
    expect(enumerateAutoPaths(g)).toEqual([
      ["request", "eligible", "inspect", "closed"],
      ["request", "eligible", "deny", "closed"],
    ]);
  });

  it("keeps parallel fan-out in one chapter (does not split stories)", () => {
    const g = graph(
      [
        node("ada", "user"),
        node("aws", "cloud"),
        node("api"),
        node("cart"),
        node("pg"),
        node("stripe"),
      ],
      [
        edge("ada", "api", 0),
        edge("aws", "api", 1),
        edge("api", "cart", 2),
        edge("cart", "pg", 3),
        edge("cart", "stripe", 4),
      ],
    );
    expect(enumerateAutoPaths(g)).toEqual([
      ["ada", "api", "cart", "pg", "stripe"],
      ["aws", "api"],
    ]);
  });

  it("stops simple cycles without looping forever", () => {
    const g = graph([node("a"), node("b")], [edge("a", "b", 0), edge("b", "a", 1)]);
    expect(enumerateAutoPaths(g)).toEqual([["a", "b"]]);
  });
});

describe("planAutoWalk", () => {
  it("emits a chapter per exclusive alternative", () => {
    const g = graph(
      [node("request", "user"), node("eligible", "choice"), node("yes"), node("no")],
      [edge("request", "eligible", 0), edge("eligible", "yes", 1), edge("eligible", "no", 2)],
    );
    expect(planAutoWalk(g)).toEqual([
      { kind: "chapter" },
      { kind: "enter", nodeId: "request" },
      { kind: "edge", from: "request", to: "eligible" },
      { kind: "enter", nodeId: "eligible" },
      { kind: "edge", from: "eligible", to: "yes" },
      { kind: "enter", nodeId: "yes" },
      { kind: "chapter" },
      { kind: "enter", nodeId: "request" },
      { kind: "edge", from: "request", to: "eligible" },
      { kind: "enter", nodeId: "eligible" },
      { kind: "edge", from: "eligible", to: "no" },
      { kind: "enter", nodeId: "no" },
    ]);
  });

  it("emits parallel-edges for concurrent fan-out", () => {
    const g = graph(
      [node("a"), node("b"), node("c"), node("d")],
      [edge("a", "b", 0), edge("a", "c", 1), edge("b", "d", 2), edge("c", "d", 3)],
    );
    expect(planAutoWalk(g)).toEqual([
      { kind: "chapter" },
      { kind: "enter", nodeId: "a" },
      {
        kind: "parallel-edges",
        edges: [
          { from: "a", to: "b" },
          { from: "a", to: "c" },
        ],
      },
      { kind: "enter-many", nodeIds: ["b", "c"] },
      {
        kind: "parallel-edges",
        edges: [
          { from: "b", to: "d" },
          { from: "c", to: "d" },
        ],
      },
      { kind: "enter", nodeId: "d" },
    ]);
  });
});

describe("traceDeclarationPath", () => {
  it("returns first-visit node order across chapters", () => {
    const g = graph(
      [
        node("request", "user"),
        node("eligible", "choice"),
        node("inspect"),
        node("deny", "warning"),
        node("closed", "success"),
      ],
      [
        edge("request", "eligible", 0),
        edge("eligible", "inspect", 1),
        edge("eligible", "deny", 2),
        edge("inspect", "closed", 3),
        edge("deny", "closed", 4),
      ],
    );
    expect(traceDeclarationPath(g)).toEqual(["request", "eligible", "inspect", "closed", "deny"]);
  });
});

describe("inferAutoAnimation", () => {
  it("returns null for empty graph", () => {
    expect(inferAutoAnimation(graph([], []))).toBeNull();
  });

  it("dims between exclusive chapters and flows each alternative from the start", () => {
    const g = graph(
      [node("request", "user"), node("eligible", "choice"), node("yes"), node("no")],
      [edge("request", "eligible", 0), edge("eligible", "yes", 1), edge("eligible", "no", 2)],
    );
    const anim = inferAutoAnimation(g);
    expect(anim).not.toBeNull();
    expect(anim!.cues.filter((c) => c.op === "dim")).toHaveLength(2);
    const flows = anim!.cues
      .filter((c) => c.op === "flow")
      .map((c) => (c.op === "flow" ? c.path.join("->") : ""));
    expect(flows).toEqual([
      "request->eligible",
      "eligible->yes",
      "request->eligible",
      "eligible->no",
    ]);
    const pulses = anim!.cues.filter((c) => c.op === "pulse");
    expect(pulses.length).toBeGreaterThanOrEqual(4);
  });

  it("wraps concurrent fan-out hops in parallel cues", () => {
    const g = graph(
      [node("a"), node("b"), node("c"), node("d")],
      [edge("a", "b", 0), edge("a", "c", 1), edge("b", "d", 2), edge("c", "d", 3)],
    );
    const anim = inferAutoAnimation(g);
    expect(anim).not.toBeNull();
    const parallels = anim!.cues.filter((c) => c.op === "parallel");
    expect(parallels.length).toBeGreaterThanOrEqual(2);
    const firstFlows = parallels[0]!;
    expect(firstFlows.op).toBe("parallel");
    if (firstFlows.op === "parallel") {
      expect(firstFlows.cues.every((c) => c.op === "flow")).toBe(true);
      expect(firstFlows.cues).toHaveLength(2);
    }
    // One story — not a chapter replay for each arm.
    expect(anim!.cues.filter((c) => c.op === "dim")).toHaveLength(1);
  });

  it("pulses intermediate nodes, not only choices", () => {
    const g = graph(
      [node("a", "user"), node("b", "service"), node("c", "success")],
      [edge("a", "b", 0), edge("b", "c", 1)],
    );
    const anim = inferAutoAnimation(g);
    expect(anim).not.toBeNull();
    const pulseTargets = anim!.cues
      .filter((c) => c.op === "pulse")
      .flatMap((c) => (c.op === "pulse" ? c.targets : []))
      .filter((t) => t.type === "node")
      .map((t) => (t.type === "node" ? t.id : ""));
    // Parallel pulse groups nest pulse ops — collect top-level sequential pulses for linear path.
    expect(pulseTargets).toEqual(["a", "b", "c"]);
  });

  it("sequence animation re-dims when activation spans change", () => {
    const g: GraphModel = {
      ...graph(
        [node("a", "participant"), node("b", "participant"), node("c", "participant")],
        [
          { ...edge("a", "b", 0, "call"), sequenceOrder: 0, sequenceKind: "sync" },
          {
            ...edge("b", "a", 1, "reply"),
            sequenceOrder: 1,
            sequenceKind: "return",
            kind: "dependency",
          },
          { ...edge("a", "b", 2, "again"), sequenceOrder: 2, sequenceKind: "sync" },
        ],
      ),
      diagramKind: "sequence",
      sequence: {
        autonumber: false,
        participantOrder: ["a", "b", "c"],
        messages: [
          { id: "e0", order: 0, from: "a", to: "b", kind: "sync", label: "call" },
          { id: "e1", order: 1, from: "b", to: "a", kind: "return", label: "reply" },
          { id: "e2", order: 2, from: "a", to: "b", kind: "sync", label: "again" },
        ],
        // c stays live through the reply, then drops before "again"
        activations: [{ id: "act0", participantId: "c", startOrder: 0, endOrder: 1 }],
        fragments: [],
        notes: [],
        dividers: [],
      },
    };
    const anim = inferAutoAnimation(g);
    expect(anim).not.toBeNull();
    const dims = anim!.cues.filter((c) => c.op === "dim");
    // First emphasis chapter + again after c deactivates.
    expect(dims.length).toBeGreaterThanOrEqual(2);
    const flows = anim!.cues.filter((c) => c.op === "flow");
    expect(flows).toHaveLength(3);
    expect(flows.every((c) => c.op === "flow" && c.edgeId != null)).toBe(true);
  });
});
