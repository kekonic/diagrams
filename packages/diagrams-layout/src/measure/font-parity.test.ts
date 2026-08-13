import { describe, expect, it } from "vite-plus/test";
import { createFontFileMeasurer } from "./font-measurer.ts";
import { createCanvasMeasurer, DEFAULT_FONT_FAMILY } from "./text-measurer.ts";
import { compile, parse } from "@kekonic/diagrams-core";
import { measureGraph } from "./measure.ts";

const STYLE = { fontSize: 14, fontFamily: DEFAULT_FONT_FAMILY, fontWeight: "500" };

describe("font parity", () => {
  it("font file measurer loads bundled Inter", () => {
    const m = createFontFileMeasurer();
    expect(m).toBeTruthy();
    const width = m!.measureText("Checkout Service", STYLE).width;
    expect(width).toBeGreaterThan(80);
    expect(width).toBeLessThan(160);
  });

  it("CLI font measurer and canvas measurer agree within tolerance on node widths", () => {
    const fontMeasurer = createFontFileMeasurer();
    expect(fontMeasurer).toBeTruthy();

    const source = `diagram "Parity" {
      direction LR
      a: service "Checkout Service"
      b: service "Payment Gateway"
      a -> b
    }`;
    const graph = compile(parse(source)).graph;
    const fontMeasured = measureGraph(graph, fontMeasurer!);
    const canvasMeasured = measureGraph(graph, createCanvasMeasurer());

    for (const id of ["a", "b"]) {
      const fw = fontMeasured.nodes.find((n) => n.nodeId === id)!.width;
      const cw = canvasMeasured.nodes.find((n) => n.nodeId === id)!.width;
      expect(Math.abs(fw - cw)).toBeLessThan(12);
    }
  });
});
