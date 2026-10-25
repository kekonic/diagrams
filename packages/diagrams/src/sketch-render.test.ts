import { describe, expect, it } from "vite-plus/test";
import { compileSource, renderPipeline } from "./pipeline/render.ts";

const FLOW = `diagram "T" {
  a: service "Orders"
  b: service "Billing"
  c: topic "orders"
  a -> b "charge"
  a => c "OrderPlaced"
  c ~> b "caught up"
}`;

const SEQUENCE = `sequence "S" {
  a: participant "A"
  b: participant "B"
  a -> b "ping"
  b --> a "pong"
  a => b "later"
  b ~> a "seen"
  alt "ok" {
    a -> b "yes"
  }
}`;

function shaftTags(svg: string): Array<{ d: string; attrs: string }> {
  return [...svg.matchAll(/<path class="flow-edge-path(?: [^"]*)?" d="([^"]*)"([^>]*)\/>/g)].map(
    (match) => ({ d: match[1]!, attrs: match[2]! }),
  );
}

function numbers(d: string): number[] {
  return [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

function withoutSketchedInk(svg: string): string {
  return svg
    .replace(
      /<path class="flow-edge-path(?: [^"]*)?" d="[^"]*"/g,
      '<path class="flow-edge-path" d=""',
    )
    .replace(/<(?:line|path) class="flow-sequence-lifeline"[^/]*\/>/g, "");
}

describe("sketch strokes", () => {
  it("redraws relationship shafts and leaves the rest of the picture precise", async () => {
    const precise = await renderPipeline(FLOW);
    const sketch = await renderPipeline(FLOW, { sketch: true });
    const again = await renderPipeline(FLOW, { sketch: true });
    expect(precise.ok).toBe(true);
    expect(sketch.ok).toBe(true);
    expect(sketch.svg).toBe(again.svg);
    expect(sketch.svg).not.toBe(precise.svg);

    const preciseShafts = shaftTags(precise.svg!);
    const sketchShafts = shaftTags(sketch.svg!);
    expect(sketchShafts).toHaveLength(preciseShafts.length);
    expect(sketchShafts.some((shaft, index) => shaft.d !== preciseShafts[index]!.d)).toBe(true);
    for (const [index, shaft] of sketchShafts.entries()) {
      const original = preciseShafts[index]!;
      expect(shaft.attrs).toBe(original.attrs);
      const from = numbers(original.d);
      const to = numbers(shaft.d);
      expect(to[0]).toBeCloseTo(from[0]!, 1);
      expect(to[1]).toBeCloseTo(from[1]!, 1);
      expect(to.at(-2)).toBeCloseTo(from.at(-2)!, 1);
      expect(to.at(-1)).toBeCloseTo(from.at(-1)!, 1);
    }
    expect(withoutSketchedInk(sketch.svg!)).toBe(withoutSketchedInk(precise.svg!));
    expect(sketch.svg).toContain('stroke-dasharray="6 4"');
    expect(sketch.svg).toContain('stroke-dasharray="2 6"');
    expect(sketch.svg).toContain('marker-end="url(#flow-arrow-open)"');
    expect(sketch.svg).toContain('marker-end="url(#flow-arrow)"');
  });

  it("lets the render call override a source sketch hint", async () => {
    const source = `diagram "T" {
      render { sketch: true }
      a: service "A"
      b: service "B"
      a -> b "call"
    }`;
    const hinted = await renderPipeline(source);
    const forcedOff = await renderPipeline(source, { sketch: false });
    const plain = await renderPipeline(`diagram "T" {
      a: service "A"
      b: service "B"
      a -> b "call"
    }`);
    expect(hinted.svg).not.toBe(plain.svg);
    expect(forcedOff.svg).toBe(plain.svg);
  });

  it("sketches sequence lifelines and message shafts without moving heads or dashes", async () => {
    const precise = await renderPipeline(SEQUENCE);
    const sketch = await renderPipeline(SEQUENCE, { sketch: true });
    expect(precise.ok).toBe(true);
    expect(sketch.ok).toBe(true);
    expect(sketch.svg).not.toBe(precise.svg);
    expect(precise.svg).toContain('<line class="flow-sequence-lifeline"');
    expect(sketch.svg).not.toContain('<line class="flow-sequence-lifeline"');
    expect(sketch.svg).toContain('<path class="flow-sequence-lifeline"');
    expect(sketch.svg).toContain('fill="none"');

    const preciseShafts = shaftTags(precise.svg!);
    const sketchShafts = shaftTags(sketch.svg!);
    expect(sketchShafts.map((shaft) => shaft.attrs)).toEqual(
      preciseShafts.map((shaft) => shaft.attrs),
    );
    expect(sketchShafts.some((shaft, index) => shaft.d !== preciseShafts[index]!.d)).toBe(true);

    const heads = (svg: string) =>
      [...svg.matchAll(/<path class="flow-sequence-message-head[^"]*" d="([^"]+)"/g)].map(
        (match) => match[1],
      );
    expect(heads(sketch.svg!)).toEqual(heads(precise.svg!));
    expect(withoutSketchedInk(sketch.svg!)).toBe(withoutSketchedInk(precise.svg!));
    expect(sketch.svg).toContain('stroke-dasharray="5 3.5"');
    expect(sketch.svg).toContain('stroke-dasharray="2 6"');
    expect(sketch.svg).not.toMatch(
      /class="flow-sequence-message flow-sequence-message-async[\s\S]*?stroke-dasharray="6 4"/,
    );
  });

  it("honors sequence render hints for sketch, shadows, and rounded corners", async () => {
    const compiled = compileSource(`sequence "S" {
      render { sketch: true shadows: true roundedCorners: true }
      a: participant "A"
      b: participant "B"
      a -> b "ping"
      alt "ok" { a -> b "yes" }
    }`);
    expect(compiled.renderHints).toMatchObject({
      sketch: true,
      shadows: true,
      roundedCorners: true,
    });

    const result = await renderPipeline(`sequence "S" {
      render { sketch: true shadows: true roundedCorners: true }
      a: participant "A"
      b: participant "B"
      a -> b "ping"
      alt "ok" { a -> b "yes" }
    }`);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain('<path class="flow-sequence-lifeline"');
    expect(result.svg).toContain('id="flow-node-shadow"');
    expect(result.svg).toContain('class="flow-sequence-fragment-box"');
    expect(result.svg).toContain('rx="8"');
  });
});
