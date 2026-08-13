import { describe, expect, it } from "vite-plus/test";
import type { GraphModel } from "@kekonic/diagrams-core";
import type { TextMeasurer } from "./text-measurer.ts";
import { measureGraph } from "./measure.ts";

const fixedMeasurer: TextMeasurer = {
  measureText(text, style) {
    const width = text.length * 8;
    const height = style.fontSize * 1.35;
    return { width, height, ascent: style.fontSize, descent: 4 };
  },
  wrapText(text, { style }) {
    const width = text.length * 8;
    const height = style.fontSize * 1.35;
    return { lines: [text], width, height };
  },
};

function graph(nodes: GraphModel["nodes"]): GraphModel {
  return { id: "m", nodes, edges: [], groups: [], styles: [], diagnostics: [] };
}

describe("measureGraph", () => {
  it("respects minWidth and uses maxWidth as a wrap preference for short labels", () => {
    const result = measureGraph(
      graph([
        {
          id: "n",
          label: "Hi",
          kind: "service",
          minWidth: 200,
          maxWidth: 220,
          styleRefs: [],
        },
      ]),
      fixedMeasurer,
    );

    const measured = result.nodes[0]!;
    expect(measured.width).toBeGreaterThanOrEqual(200);
    expect(measured.width).toBeLessThanOrEqual(220);
    expect(measured.nodeId).toBe("n");
    expect(measured.labelLines).toEqual(["Hi"]);
  });

  it("grows past maxWidth when a label word cannot wrap", () => {
    const result = measureGraph(
      graph([
        {
          id: "await",
          label: "Await PaymentCaptured",
          kind: "event",
          shape: "pill",
          icon: "timer",
          note: "Signal or 15m timer",
          maxWidth: 180,
          styleRefs: [],
        },
      ]),
      fixedMeasurer,
    ).nodes[0]!;

    // fixedMeasurer: each char is 8px → "PaymentCaptured" alone is 128px of text,
    // plus icon column + padding, so the box must exceed the 180 wrap cap.
    expect(result.width).toBeGreaterThan(180);
    expect(result.labelLines.some((l) => l.includes("PaymentCaptured"))).toBe(true);
  });

  it("sizes diamond choice nodes with extra padding", () => {
    const result = measureGraph(
      graph([{ id: "c", label: "?", kind: "choice", shape: "diamond", styleRefs: [] }]),
      fixedMeasurer,
    );

    const measured = result.nodes[0]!;
    expect(measured.width).toBeGreaterThanOrEqual(80);
    expect(measured.height).toBeGreaterThanOrEqual(80);
  });

  it("keeps cloud nodes near the Material 3:2 silhouette", () => {
    const measured = measureGraph(
      graph([
        {
          id: "aws",
          label: "AWS",
          kind: "cloud",
          shape: "cloud",
          icon: "logos:aws",
          styleRefs: [],
        },
      ]),
      fixedMeasurer,
    ).nodes[0]!;

    expect(measured.width / measured.height).toBeGreaterThan(1.4);
    expect(measured.width / measured.height).toBeLessThanOrEqual(1.6);
  });

  it("sizes person nodes with a head stack and a torso that grows with the label", () => {
    const short = measureGraph(
      graph([{ id: "a", label: "Ada", kind: "person", shape: "person", styleRefs: [] }]),
      fixedMeasurer,
    ).nodes[0]!;
    const long = measureGraph(
      graph([
        {
          id: "b",
          label: "Customer Support Lead",
          kind: "person",
          shape: "person",
          showSubtitle: true,
          styleRefs: [],
        },
      ]),
      fixedMeasurer,
    ).nodes[0]!;

    expect(short.height).toBeGreaterThan(short.width * 0.7);
    expect(long.width).toBeGreaterThan(short.width);
    // Content lives in the torso (not under the feet).
    expect(long.contentBox.y).toBeLessThan(long.height * 0.55);
  });

  it("adds height for icons and subtitles on card shapes", () => {
    const plain = measureGraph(
      graph([{ id: "a", label: "Plain", kind: "service", styleRefs: [] }]),
      fixedMeasurer,
    ).nodes[0]!;

    const rich = measureGraph(
      graph([
        {
          id: "b",
          label: "Rich",
          kind: "service",
          icon: "database",
          showSubtitle: true,
          note: "footnote",
          styleRefs: [],
        },
      ]),
      fixedMeasurer,
    ).nodes[0]!;

    expect(rich.height).toBeGreaterThan(plain.height);
  });

  it("grows card width to fit a long authored subtitle", () => {
    const short = measureGraph(
      graph([
        {
          id: "a",
          label: "Checkout",
          kind: "service",
          icon: "shopping-cart",
          styleRefs: [],
        },
      ]),
      fixedMeasurer,
    ).nodes[0]!;

    const longSub = measureGraph(
      graph([
        {
          id: "b",
          label: "Checkout",
          kind: "service",
          icon: "shopping-cart",
          subtitle: "owns payment intents",
          styleRefs: [],
        },
      ]),
      fixedMeasurer,
    ).nodes[0]!;

    expect(longSub.width).toBeGreaterThan(short.width);
    // Uppercased subtitle "OWNS PAYMENT INTENTS" (20 chars * 8) dominates title "Checkout" (8*8).
    expect(longSub.width).toBeGreaterThanOrEqual(20 * 8);
  });

  it("grows the left icon column for wide logos when preloaded", async () => {
    const { preloadIcons, registerIcon, resetIconCaches } = await import("@kekonic/diagrams-icons");
    const { cardIconColumnWidth } = await import("./measure.ts");
    resetIconCaches();
    registerIcon("test:banner", {
      body: `<rect width="48" height="16" fill="currentColor"/>`,
      viewBox: "0 0 48 16",
      width: 48,
      height: 16,
      paint: "fill",
    });
    await preloadIcons(["lucide:cloud"]);
    const wide = cardIconColumnWidth("test:banner");
    const square = cardIconColumnWidth("lucide:cloud");
    expect(wide).toBeGreaterThan(square);
    expect(square).toBeGreaterThanOrEqual(32);
    // 20px tall × 1.75 max aspect = 35
    expect(wide).toBe(35);
  });

  it("scales box and uses larger font metrics when scale is set", () => {
    const plain = measureGraph(
      graph([{ id: "a", label: "Service", kind: "service", styleRefs: [] }]),
      fixedMeasurer,
    ).nodes[0]!;
    const scaled = measureGraph(
      graph([{ id: "b", label: "Service", kind: "service", scale: 1.4, styleRefs: [] }]),
      fixedMeasurer,
    ).nodes[0]!;

    expect(scaled.width).toBeGreaterThan(plain.width);
    expect(scaled.height).toBeGreaterThan(plain.height);
  });

  it("sizes ERD table nodes from header and column rows", () => {
    const result = measureGraph(
      graph([
        {
          id: "orders",
          label: "orders",
          kind: "table",
          shape: "table",
          styleRefs: [],
          columns: [
            { name: "id", type: "uuid", keys: ["pk"] },
            { name: "customer_id", type: "uuid", keys: ["fk"] },
            { name: "status", type: "text", keys: [] },
          ],
        },
      ]),
      fixedMeasurer,
    ).nodes[0]!;

    expect(result.height).toBe(28 + 3 * 20);
    expect(result.width).toBeGreaterThanOrEqual(180);
    expect(result.labelLines).toEqual(["orders"]);
  });
});
