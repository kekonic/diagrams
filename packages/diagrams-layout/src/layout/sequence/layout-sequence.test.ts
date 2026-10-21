import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { compile, parse, rectsOverlap, type Rect } from "@kekonic/diagrams-core";
import { measureGraph } from "../../measure/measure.ts";
import { DEFAULT_FONT_FAMILY, defaultMeasurer } from "../../measure/text-measurer.ts";
import { layoutAndRouteWithElk } from "../elk/layout-with-elk.ts";

const COMPLETE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../../../examples/complete-sequence.kdiagram",
  ),
  "utf8",
);

async function layoutSource(src: string) {
  const compiled = compile(parse(src));
  expect(compiled.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
  const measured = measureGraph(compiled.graph);
  const result = await layoutAndRouteWithElk(compiled.graph, measured.nodes, compiled.layoutHints);
  return { compiled, result, seq: result.layout.sequence! };
}

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
    expect(seq.footers).toEqual([]);
  });

  it("stacks a self call to the right of the outer execution bar", async () => {
    const { seq } = await layoutSource(`
sequence {
  a: participant "A"
  b: participant "B"
  a -> b "call"
  activate b
  b -> b "again"
  b --> a "done"
}
`);
    const onB = seq.activations.filter((act) => act.participantId === "b");
    const self = onB.find((act) => act.startOrder === act.endOrder);
    const outer = onB.find(
      (act) => act.startOrder < (self?.startOrder ?? 0) && act.endOrder >= (self?.endOrder ?? 0),
    );
    expect(self).toBeTruthy();
    expect(outer).toBeTruthy();
    expect(self!.bounds.x).toBeGreaterThan(outer!.bounds.x + 2);
    expect(self!.bounds.height).toBeLessThan(outer!.bounds.height);
  });

  it("lays out the complete checkout sequence without collisions", async () => {
    const { compiled, result, seq } = await layoutSource(COMPLETE);
    const again = await layoutSource(COMPLETE);
    expect(JSON.stringify(seq)).toBe(JSON.stringify(again.seq));

    const orderOf = new Map(compiled.graph.sequence!.messages.map((msg) => [msg.id, msg.order]));
    const ordered = [...seq.messages].sort(
      (a, b) => (orderOf.get(a.messageId) ?? 0) - (orderOf.get(b.messageId) ?? 0),
    );
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]!.points[0]!.y).toBeGreaterThan(ordered[i - 1]!.points[0]!.y);
    }

    const chips = seq.messages
      .map((msg) => msg.labelBounds)
      .filter((bounds): bounds is Rect => bounds != null);
    for (let i = 0; i < chips.length; i++) {
      for (let j = i + 1; j < chips.length; j++) {
        expect(rectsOverlap(chips[i]!, chips[j]!, 1)).toBe(false);
      }
      for (const node of result.layout.nodes) {
        expect(rectsOverlap(chips[i]!, node.bounds, 0)).toBe(false);
      }
      for (const frag of seq.fragments) {
        expect(rectsOverlap(chips[i]!, frag.tab, 0)).toBe(false);
      }
    }

    for (const msg of seq.messages) {
      if (!msg.labelCenter) continue;
      expect(msg.points[0]!.y - msg.labelCenter.y).toBeGreaterThanOrEqual(12);
      expect(msg.labelBounds!.y + msg.labelBounds!.height).toBeLessThanOrEqual(
        msg.points[0]!.y - 4,
      );
    }

    const hold = seq.messages.find((msg) => msg.label === "place hold")!;
    const bank = seq.lifelines.find((life) => life.participantId === "bank")!;
    const bankBar = seq.activations.find((act) => act.participantId === "bank");
    expect(hold.points[1]!.x).toBeLessThan(bank.x - 2);
    expect(Math.abs(hold.points[1]!.x - bankBar!.bounds.x)).toBeLessThan(1.5);

    const auth = seq.messages.find((msg) => msg.label?.includes("idempotency"))!;
    const span = Math.abs(auth.points[0]!.x - auth.points[auth.points.length - 1]!.x);
    expect(span + 4).toBeGreaterThanOrEqual(auth.labelBounds!.width);

    const shipment = result.layout.nodes.find((node) => node.nodeId === "shipment")!;
    const shopper = result.layout.nodes.find((node) => node.nodeId === "shopper")!;
    const create = seq.messages.find((msg) => msg.kind === "create")!;
    const destroy = seq.messages.find((msg) => msg.kind === "destroy")!;
    const shipmentLife = seq.lifelines.find((life) => life.participantId === "shipment")!;
    expect(shipment.bounds.y).toBeGreaterThan(shopper.bounds.y + shopper.bounds.height);
    expect(create.points[0]!.y).toBeCloseTo(shipment.bounds.y + shipment.bounds.height / 2, 0);
    expect(shipmentLife.y0).toBeGreaterThanOrEqual(
      shipment.bounds.y + shipment.bounds.height - 0.5,
    );
    expect(shipmentLife.y1).toBeLessThanOrEqual(
      Math.min(...destroy.points.map((point) => point.y)),
    );
    expect(seq.footers.some((footer) => footer.participantId === "shipment")).toBe(false);

    const shopperFooter = seq.footers.find((footer) => footer.participantId === "shopper")!;
    const shopperLife = seq.lifelines.find((life) => life.participantId === "shopper")!;
    expect(shopperFooter.bounds.x).toBeCloseTo(shopper.bounds.x, 0);
    expect(shopperLife.y1).toBeCloseTo(shopperFooter.bounds.y, 0);
    expect(shopperFooter.bounds.y).toBeGreaterThan(shopperLife.y0 + 200);

    const alt = seq.fragments.find((frag) => frag.operator === "alternate")!;
    const loop = seq.fragments.find((frag) => frag.operator === "loop")!;
    expect(containsRect(alt.bounds, loop.bounds)).toBe(true);
    const brk = seq.fragments.find((frag) => frag.operator === "break")!;
    expect(shopper.bounds.x + shopper.bounds.width).toBeLessThan(brk.bounds.x);

    const note = seq.notes.find((item) => item.text.includes("authenticated"))!;
    expect(note.lines.length).toBeGreaterThan(1);
    expect(note.bounds.x).toBeGreaterThanOrEqual(8);

    const found = seq.messages.find((msg) => msg.label === "edge retry")!;
    const lost = seq.messages.find((msg) => msg.label === "dropped ack")!;
    const web = seq.lifelines.find((life) => life.participantId === "web")!;
    expect(found.endpointAt).toBe("start");
    expect(found.endpoint!.x).toBeLessThan(web.x);
    expect(lost.endpointAt).toBe("end");
    expect(lost.endpoint!.x).toBeGreaterThan(web.x);
    expect(found.endpoint!.x + 8).toBeLessThanOrEqual(found.labelBounds!.x);
    expect(lost.labelBounds!.x + lost.labelBounds!.width + 4).toBeLessThanOrEqual(
      lost.endpoint!.x - 4,
    );

    for (const frag of seq.fragments) {
      expect(frag.tab.x + frag.tab.width + 8).toBeLessThanOrEqual(
        frag.bounds.x + frag.bounds.width,
      );
      if (frag.guard) {
        expect(frag.guard.x).toBeGreaterThanOrEqual(frag.tab.x + frag.tab.width + 6);
        expect(frag.guard.x + guardTextWidth(frag.guard.text)).toBeLessThanOrEqual(
          frag.bounds.x + frag.bounds.width - 8,
        );
      }
      for (const label of frag.operandLabels) {
        expect(label.x + guardTextWidth(label.text)).toBeLessThanOrEqual(
          frag.bounds.x + frag.bounds.width - 8,
        );
      }
    }

    const section = seq.fragments.find((frag) => frag.operator === "section")!;
    const sideNote = seq.notes.find((note) => note.text.includes("carrier"))!;
    expect(containsRect(section.bounds, sideNote.bounds)).toBe(true);
    const critical = seq.fragments.find((frag) => frag.operator === "critical")!;
    expect(critical.guard?.text).toBe("single writer");
    expect(critical.bounds.width).toBeGreaterThan(critical.tab.width + 80);
    for (const frag of seq.fragments) {
      const labels = [...frag.operandLabels, ...(frag.guard ? [frag.guard] : [])];
      for (const label of labels) {
        const text: Rect = {
          x: label.x,
          y: label.y - 12,
          width: guardTextWidth(label.text),
          height: 15,
        };
        for (const act of seq.activations) {
          expect(rectsOverlap(text, act.bounds, 1)).toBe(false);
        }
      }
    }

    const self = seq.messages.find((msg) => msg.label === "validate cart")!;
    const orders = seq.lifelines.find((life) => life.participantId === "orders")!;
    expect(Math.max(...self.points.map((point) => point.x))).toBeGreaterThan(orders.x + 20);

    expect(result.layout.width).toBeGreaterThan(result.layout.nodes.at(-1)!.bounds.x);
    expect(result.layout.height).toBeGreaterThan(
      shopperFooter.bounds.y + shopperFooter.bounds.height,
    );
  });

  it("hangs a payload card under the arrow without covering the next chip", async () => {
    const { result, seq } = await layoutSource(`
sequence {
  a: participant "A"
  b: participant "B"
  a -> b "POST /checkout" {
    payload: "{
      \\"cartId\\": \\"c_91\\"
    }"
  }
  b --> a "201"
}
`);
    const call = seq.messages.find((msg) => msg.label === "POST /checkout")!;
    const reply = seq.messages.find((msg) => msg.label === "201")!;
    const card = call.payloadBounds!;
    expect(call.payloadLines?.[0]).toBe("{");
    expect(call.payloadLines?.[1]?.startsWith(" ")).toBe(true);
    expect(call.payloadLines?.join("\n")).toContain('"cartId": "c_91"');
    expect(card.y).toBeGreaterThan(call.points[0]!.y + 8);
    expect(call.labelBounds).toBeTruthy();
    expect(card.y).toBeGreaterThan(call.labelBounds!.y + call.labelBounds!.height);
    expect(rectsOverlap(card, call.labelBounds!)).toBe(false);
    expect(reply.labelBounds!.y).toBeGreaterThan(card.y + card.height + 16);
    expect(reply.points[0]!.y).toBeGreaterThan(card.y + card.height);
    expect(result.layout.height).toBeGreaterThan(card.y + card.height);
  });

  it("places a self-call excerpt below the loop and keeps a card inside its fragment", async () => {
    const { seq } = await layoutSource(`
sequence {
  a: participant "A"
  b: participant "B"
  a -> a "save" {
    payload: "{
      \\"ok\\": true
    }"
  }
  alternate "pay" {
    a -> b "POST /pay" {
      payload: "{
        \\"n\\": 1
      }"
    }
  }
}
`);
    const self = seq.messages.find((msg) => msg.label === "save")!;
    expect(self.payloadBounds!.y).toBeGreaterThan(Math.max(...self.points.map((point) => point.y)));
    const frag = seq.fragments.find((item) => item.operator === "alternate")!;
    const pay = seq.messages.find((msg) => msg.label === "POST /pay")!;
    expect(containsRect(frag.bounds, pay.payloadBounds!)).toBe(true);
    const again = await layoutSource(`
sequence {
  a: participant "A"
  b: participant "B"
  a -> a "save" {
    payload: "{
      \\"ok\\": true
    }"
  }
  alternate "pay" {
    a -> b "POST /pay" {
      payload: "{
        \\"n\\": 1
      }"
    }
  }
}
`);
    expect(JSON.stringify(seq)).toBe(JSON.stringify(again.seq));
  });

  it("shortens an excerpt to six lines and keeps the ellipsis", async () => {
    const { seq } = await layoutSource(`
sequence {
  a: participant "A"
  b: participant "B"
  a -> b "body" {
    payload: "one
two
three
four
five
six
seven"
  }
}
`);
    const card = seq.messages.find((msg) => msg.label === "body")!;
    expect(card.payloadLines).toEqual(["one", "two", "three", "four", "five", "…"]);
  });
});

/** Mirrors fragment guard measurement in layout-sequence.ts (11px bold + 0.01em tracking). */
function guardTextWidth(text: string): number {
  const label = `[${text}]`;
  return (
    defaultMeasurer.measureText(label, {
      fontSize: 11,
      fontFamily: DEFAULT_FONT_FAMILY,
      fontWeight: "700",
    }).width +
    label.length * 0.11
  );
}

function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5
  );
}
