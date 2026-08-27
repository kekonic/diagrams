import { describe, expect, it } from "vite-plus/test";
import type { GraphModel } from "@kekonic/diagrams-core";
import { swimlaneProcessRanks } from "./swimlane-timeline.ts";

describe("swimlane process ranks", () => {
  it("keeps the happy-path spine and treats resubmit as feedback", () => {
    const graph: GraphModel = {
      id: "expense",
      nodes: [
        { id: "submit", label: "Submit", kind: "task", styleRefs: [], groupId: "employee" },
        { id: "correct", label: "Correct", kind: "task", styleRefs: [], groupId: "employee" },
        { id: "validate", label: "Validate", kind: "task", styleRefs: [], groupId: "controls" },
        { id: "approve", label: "Approve", kind: "decision", styleRefs: [], groupId: "manager" },
        { id: "paid", label: "Paid", kind: "task", styleRefs: [], groupId: "manager" },
        { id: "reject", label: "Reject", kind: "task", styleRefs: [], groupId: "manager" },
      ],
      edges: [
        { id: "e1", from: "submit", to: "validate", kind: "sync", styleRefs: [], priority: "high" },
        {
          id: "e2",
          from: "validate",
          to: "approve",
          label: "valid",
          kind: "sync",
          styleRefs: [],
          priority: "high",
        },
        {
          id: "e3",
          from: "validate",
          to: "correct",
          label: "needs correction",
          kind: "sync",
          styleRefs: [],
        },
        { id: "e4", from: "correct", to: "submit", label: "resubmit", kind: "sync", styleRefs: [] },
        {
          id: "e5",
          from: "approve",
          to: "paid",
          label: "yes",
          kind: "sync",
          styleRefs: [],
          priority: "high",
        },
        { id: "e6", from: "approve", to: "reject", label: "no", kind: "sync", styleRefs: [] },
        { id: "e7", from: "reject", to: "correct", kind: "sync", styleRefs: [] },
      ],
      groups: [],
      styles: [],
      diagnostics: [],
    };

    const { rank, feedbackEdgeIds } = swimlaneProcessRanks(graph);
    expect([...feedbackEdgeIds]).toEqual(["e4"]);
    expect(rank.get("submit")).toBeLessThan(rank.get("validate")!);
    expect(rank.get("validate")).toBeLessThan(rank.get("approve")!);
    expect(rank.get("approve")).toBeLessThan(rank.get("paid")!);
    expect(rank.get("submit")).toBeLessThan(rank.get("correct")!);
  });
});
