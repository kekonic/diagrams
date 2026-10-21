import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import type { LayoutResult } from "@kekonic/diagrams-layout";
import { KDiagram } from "../index.ts";

const COMPLETE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../examples/complete-sequence.kdiagram"),
  "utf8",
);

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
    expect(result.svg).toContain("Alternate");
    expect(result.svg).toContain("[ok]");
    expect(result.svg).toContain("flow-sequence-fragment-box");
    expect(result.svg).toContain("flow-sequence-fragment-tab");
    expect(result.svg).toContain("flow-sequence-message-label-bg");
    expect(result.svg).toContain("flow-sequence-message-head-filled");
    expect(result.svg).toContain("flow-sequence-message-head-open");
    // Animation player binds edges via from/to + flow-edge-path.
    expect(result.svg).toContain('data-edge-from="a"');
    expect(result.svg).toContain('data-edge-to="b"');
    expect(result.svg).toContain("flow-edge-path");
    expect(result.svg).toContain('data-theme="dark"');
    expect(result.svg).toContain("flow-sequence-canvas");
    expect(result.svg).toContain("flow-edge-failure");
    expect(result.svg).toContain("flow-sequence-activation");
    expect(result.svg).toContain("data-sequence-order");
    const layout = result.layout as LayoutResult | undefined;
    expect(layout?.algorithmVersion).toBe("sequence-v1");
    expect(result.graph?.diagramKind).toBe("sequence");
  });

  it("escapes message text", async () => {
    const result = await KDiagram.renderToSvg(`
sequence {
  a: participant "A"
  b: participant "B"
  a -> b "a < b & c"
}
`);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain("a &lt; b &amp; c");
    expect(result.svg).not.toContain("a < b & c");
  });

  it("renders the complete checkout sequence", async () => {
    const result = await KDiagram.renderToSvg(COMPLETE, { theme: "light", snapshotTheme: true });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    const svg = result.svg ?? "";
    expect(svg).toContain("flow-sequence-lifeline");
    expect(svg).toContain("flow-sequence-activation");
    expect(svg).toContain("flow-sequence-fragment-tab");
    expect(svg).toContain("flow-sequence-fragment-alternate");
    expect(svg).toContain("flow-sequence-fragment-loop");
    expect(svg).toContain("flow-sequence-fragment-parallel");
    expect(svg).toContain("flow-sequence-fragment-critical");
    expect(svg).toContain("flow-sequence-fragment-break");
    expect(svg).toContain("flow-sequence-fragment-section");
    expect(svg).toContain("flow-sequence-fragment-optional");
    expect(svg).toContain("flow-sequence-message-head-filled");
    expect(svg).toContain("flow-sequence-message-head-open");
    expect(svg).toContain("flow-sequence-endpoint");
    expect(svg).toContain("flow-sequence-destroy");
    expect(svg).toContain("flow-sequence-note-card");
    expect(svg).toContain("flow-sequence-note-fold");
    expect(svg).toContain("flow-sequence-divider-chip");
    expect(svg).toContain("flow-sequence-badge");
    expect(svg).toContain('data-sequence-footer="true"');
    expect(svg).toContain("Authorize with the cart idempotency key");
    expect(svg).toContain("[funds captured]");
    expect(svg).toContain("[declined]");
    expect(svg).toContain("Shipment");
    expect(svg).not.toContain('marker-end="url(#flow-arrow)"');
    const layout = result.layout as LayoutResult;
    const shipment = layout.nodes.find((node) => node.nodeId === "shipment");
    const shopper = layout.nodes.find((node) => node.nodeId === "shopper");
    expect(shipment && shopper && shipment.bounds.y).toBeGreaterThan(
      shopper!.bounds.y + shopper!.bounds.height,
    );
    expect(layout.sequence?.footers.some((footer) => footer.participantId === "shipment")).toBe(
      false,
    );
    expect(layout.sequence?.footers.some((footer) => footer.participantId === "shopper")).toBe(
      true,
    );
  });

  it("renders a payload excerpt under the call, with the tone of the message", async () => {
    const result = await KDiagram.renderToSvg(`
sequence {
  a: participant "A"
  b: participant "B"
  a -> b "POST /checkout" {
    payload: "{
      \\"note\\": \\"a < b\\"
    }"
  }
  a => b "AuthorizeRequested" {
    payload: "{
      \\"amount\\": 4200
    }"
  }
  b --> a "authorized" {
    payload: "{
      \\"status\\": \\"ok\\"
    }"
  }
  a -x b "declined" {
    payload: "{
      \\"code\\": \\"card_declined\\"
    }"
  }
}
`);
    expect(result.ok).toBe(true);
    const svg = result.svg ?? "";
    expect(svg).toContain("flow-sequence-payload-call");
    expect(svg).toContain("flow-sequence-payload-async");
    expect(svg).toContain("flow-sequence-payload-return");
    expect(svg).toContain("flow-sequence-payload-failure");
    expect(svg).toContain('xml:space="preserve"');
    expect(svg).toContain("a &lt; b");
    expect(svg).not.toContain("a < b");
    expect(svg).not.toContain("<script");
    expect(svg).toContain("POST /checkout");
    expect(svg).toContain("AuthorizeRequested");
  });
});
