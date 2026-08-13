import { describe, expect, it } from "vite-plus/test";
import type { LayoutResult } from "@kekonic/diagrams-layout";
import { KDiagram } from "../index.ts";

describe("sequence render pipeline", () => {
  it("renders SVG with lifelines and messages", async () => {
    const src = `
sequence "Hello" {
  autonumber
  a: participant "A"
  b: participant "B"
  a -> b "ping"
  b --> a "pong"
  alt "ok" is success {
    a -> b "yes"
  } else "no" is danger {
    a -x b "fail"
  }
}
`;
    const result = await KDiagram.renderToSvg(src);
    expect(result.ok).toBe(true);
    expect(result.svg).toBeTruthy();
    expect(result.svg).toContain("flow-sequence-lifeline");
    expect(result.svg).toContain("flow-sequence-message");
    expect(result.svg).toContain("flow-sequence-fragment");
    expect(result.svg).toContain("flow-sequence-fragment-alternate");
    expect(result.svg).toContain("kd-style-success");
    expect(result.svg).toContain("kd-style-danger");
    expect(result.svg).toContain("flow-sequence-fragment-operand");
    expect(result.svg).toContain("--kd-sequence-fragment-fill");
    expect(result.svg).toContain("data-start-order=");
    expect(result.svg).toContain("Alternate [ok]");
    expect(result.svg).toContain("flow-sequence-fragment-box");
    expect(result.svg).toContain('stroke-dasharray="7 5"');
    // Animation player binds edges via from/to + flow-edge-path.
    expect(result.svg).toContain('data-edge-from="a"');
    expect(result.svg).toContain('data-edge-to="b"');
    expect(result.svg).toContain("flow-edge-path");
    expect(result.svg).toContain('data-theme="dark"');
    expect(result.svg).toContain("flow-sequence-canvas");
    expect(result.svg).toContain('marker-end="url(#flow-arrow)"');
    expect(result.svg).toContain("flow-edge-failure");
    expect(result.svg).toContain("flow-sequence-activation");
    expect(result.svg).toContain("data-sequence-order");
    const layout = result.layout as LayoutResult | undefined;
    expect(layout?.algorithmVersion).toBe("sequence-v1");
    expect(result.graph?.diagramKind).toBe("sequence");
  });
});
