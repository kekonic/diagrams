import { describe, expect, it } from "vite-plus/test";
import { compile, parse } from "@kekonic/diagrams-core";
import { measureGraph } from "../../measure/measure.ts";
import { layoutAndRouteWithElk } from "../elk/layout-with-elk.ts";

describe("sequence layout", () => {
  it("places participants, messages, and fragments", async () => {
    const src = `
sequence "T" {
  a: participant "A"
  b: participant "B"
  a -> b "hi"
  b --> a "ok"
  alt "x" {
    a -> b "y"
  } else "z" {
    a -x b "no"
  }
}
`;
    const compiled = compile(parse(src));
    expect(compiled.graph.diagramKind).toBe("sequence");
    const measured = measureGraph(compiled.graph);
    const result = await layoutAndRouteWithElk(
      compiled.graph,
      measured.nodes,
      compiled.layoutHints,
    );
    expect(result.layout.algorithmVersion).toBe("sequence-v1");
    expect(result.layout.sequence?.lifelines).toHaveLength(2);
    expect(result.layout.sequence?.messages.length).toBeGreaterThanOrEqual(4);
    expect(result.layout.sequence?.fragments).toHaveLength(1);
    expect(result.layout.width).toBeGreaterThan(0);
    expect(result.layout.height).toBeGreaterThan(0);
  });

  it("keeps notes and dividers from colliding with neighboring message paths", async () => {
    const src = `
sequence {
  autonumber
  a: participant "A"
  b: participant "B"
  a -> b "before"
  divider "Await something important"
  note over a, b "Shared context that should not sit on the next arrow"
  b --> a "after"
  a -> a "self fail"
}
`;
    const compiled = compile(parse(src));
    const measured = measureGraph(compiled.graph);
    const result = await layoutAndRouteWithElk(
      compiled.graph,
      measured.nodes,
      compiled.layoutHints,
    );
    const seq = result.layout.sequence!;
    const before = seq.messages.find((m) => m.label === "before")!;
    const after = seq.messages.find((m) => m.label === "after")!;
    const self = seq.messages.find((m) => m.label === "self fail")!;
    const note = seq.notes[0]!;
    const divider = seq.dividers[0]!;

    const beforeY = before.points[0]!.y;
    const afterY = after.points[0]!.y;
    expect(divider.y).toBeGreaterThan(beforeY + 16);
    expect(note.bounds.y).toBeGreaterThan(divider.y + 8);
    expect(afterY).toBeGreaterThan(note.bounds.y + note.bounds.height + 8);
    // Self-message U-bend needs vertical room and label clearance.
    expect(self.points[self.points.length - 1]!.y - self.points[0]!.y).toBeGreaterThanOrEqual(16);
    if (before.labelCenter) expect(beforeY - before.labelCenter.y).toBeGreaterThanOrEqual(12);
  });
});
