import { describe, expect, it } from "vite-plus/test";
import { bindSequenceFlowEdgeIds, compile, flowHopEdgeId, parse } from "../index.ts";
import type { AnimationCue } from "./types.ts";

describe("flowHopEdgeId", () => {
  it("prefers index-aligned edgeIds and limits lone edgeId to hop 0", () => {
    expect(flowHopEdgeId(0, { edgeId: "only" })).toBe("only");
    expect(flowHopEdgeId(1, { edgeId: "only" })).toBeUndefined();
    expect(flowHopEdgeId(1, { edgeId: "only", edgeIds: ["a", "b"] })).toBe("b");
  });
});

describe("bindSequenceFlowEdgeIds", () => {
  it("binds authored flow hops to successive matching sequence messages", () => {
    const src = `sequence {
      a: service "A"
      b: service "B"
      a -> b "one"
      a -> b "two"
      b -> a "reply"
      animation "Story" {
        dim *
        flow a -> b for 100ms
        flow a -> b for 100ms
        flow b -> a for 100ms
      }
    }`;
    const { graph } = compile(parse(src));
    const anim = graph.animations?.[0];
    expect(anim?.cues.length).toBeGreaterThan(0);
    const bound = bindSequenceFlowEdgeIds(graph, anim!.cues);
    const flows = bound.filter((c): c is Extract<AnimationCue, { op: "flow" }> => c.op === "flow");
    expect(flows).toHaveLength(3);
    expect(flows[0]!.edgeIds).toEqual([flows[0]!.edgeId]);
    expect(flows[1]!.edgeIds).toEqual([flows[1]!.edgeId]);
    expect(flows[0]!.edgeId).not.toBe(flows[1]!.edgeId);

    const msgs = graph.sequence!.messages.filter((m) => m.kind !== "destroy");
    expect(flows[0]!.edgeId).toBe(msgs[0]!.id);
    expect(flows[1]!.edgeId).toBe(msgs[1]!.id);
    expect(flows[2]!.edgeId).toBe(msgs[2]!.id);
  });

  it("assigns hop-aligned edgeIds for multi-hop flows", () => {
    const src = `sequence {
      a: service "A"
      b: service "B"
      c: service "C"
      a -> b "ab"
      b -> c "bc"
      animation "Story" {
        flow a -> b -> c for 300ms
      }
    }`;
    const { graph } = compile(parse(src));
    const bound = bindSequenceFlowEdgeIds(graph, graph.animations![0]!.cues);
    const flow = bound.find((c): c is Extract<AnimationCue, { op: "flow" }> => c.op === "flow");
    expect(flow?.edgeIds).toHaveLength(2);
    expect(flow?.edgeId).toBe(flow?.edgeIds?.[0]);
  });

  it("leaves non-sequence graphs unchanged", () => {
    const src = `diagram {
      a: service "A"
      b: service "B"
      a -> b
      animation "Story" {
        flow a -> b for 100ms
      }
    }`;
    const { graph } = compile(parse(src));
    const cues = graph.animations![0]!.cues;
    expect(bindSequenceFlowEdgeIds(graph, cues)).toEqual(cues);
  });
});
