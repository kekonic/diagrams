import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { bindSequenceFlowEdgeIds, compile, flowHopEdgeId, parse } from "../index.ts";
import type { AnimationCue } from "./types.ts";

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), "../../../../examples");

function boundFlowLabels(file: string, animation: string): string[] {
  const ast = parse(readFileSync(join(EXAMPLES, file), "utf8"));
  const { graph, diagnostics } = compile(ast);
  expect(
    [...ast.diagnostics, ...diagnostics]
      .filter((d) => d.severity === "error")
      .map((d) => d.message),
  ).toEqual([]);
  const anim = graph.animations?.find((item) => item.name === animation);
  expect(anim, animation).toBeTruthy();
  const labels: string[] = [];
  const walk = (cues: AnimationCue[]) => {
    for (const cue of cues) {
      if (cue.op === "parallel") {
        walk(cue.cues);
        continue;
      }
      if (cue.op !== "flow") continue;
      expect(cue.edgeId, `${animation}: ${cue.path.join(" -> ")} ${cue.label ?? ""}`).toBeTruthy();
      labels.push(
        graph.sequence!.messages.find((message) => message.id === cue.edgeId)?.label ?? "",
      );
    }
  };
  walk(bindSequenceFlowEdgeIds(graph, anim!.cues));
  return labels;
}

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

  it("binds a quoted flow label to that sequence message", () => {
    const src = `sequence {
      payments: service "Payments"
      bank: external "Bank"
      payments -> bank "place hold"
      payments -> bank "capture part"
      payments -> bank "void hold"
      animation "Declined" {
        flow payments -> bank "void hold" for 500ms
      }
    }`;
    const ast = parse(src);
    const { graph, diagnostics } = compile(ast);
    expect([...ast.diagnostics, ...diagnostics].filter((d) => d.severity === "error")).toEqual([]);
    const bound = bindSequenceFlowEdgeIds(graph, graph.animations![0]!.cues);
    const flow = bound.find((c): c is Extract<AnimationCue, { op: "flow" }> => c.op === "flow");
    const message = graph.sequence!.messages.find((m) => m.id === flow?.edgeId);
    expect(message?.label).toBe("void hold");
  });

  it("walks the sequence examples along the arrows each story names", () => {
    expect(boundFlowLabels("charge-cart-sequence.kdiagram", "Charge authorized")).toEqual([
      "POST /checkout",
      "PlaceOrder",
      "AuthorizeRequested",
      "AuthorizeRequested",
      "authorized",
      "201 Created",
    ]);
    expect(boundFlowLabels("complete-sequence.kdiagram", "Funds captured")).toEqual([
      "POST /checkout",
      "PlaceOrder",
      "validate cart",
      "Authorize with the cart idempotency key",
      "place hold",
      "authorized",
      "auth ref",
      "capture part",
      "commit",
      "OrderAccepted",
      "capture booked",
      "pending notice",
      "flush outbox",
      "open handoff",
      "Shipment",
      "start picking",
      "tracking",
      "201 Created",
    ]);
    expect(boundFlowLabels("complete-sequence.kdiagram", "Declined")).toEqual([
      "POST /checkout",
      "PlaceOrder",
      "Authorize with the cart idempotency key",
      "place hold",
      "authorized",
      "auth ref",
      "void hold",
      "402 Payment Required",
    ]);
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
