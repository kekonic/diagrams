import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { renderPipeline } from "./pipeline/render.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const SOURCE = readFileSync(join(ROOT, "examples/order-api-contract.kdiagram"), "utf8");

describe("interface ball and socket", () => {
  it("renders the Orders API contract with a small ball and an open socket", async () => {
    const result = await renderPipeline(SOURCE);
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);

    const have = result.graph?.nodes.find((node) => node.id === "have");
    const need = result.graph?.nodes.find((node) => node.id === "need");
    expect(have?.shape).toBe("ball");
    expect(need?.shape).toBe("socket");

    const haveBounds = result.layout?.nodes.find((node) => node.nodeId === "have")?.bounds;
    const needBounds = result.layout?.nodes.find((node) => node.nodeId === "need")?.bounds;
    expect(haveBounds?.height).toBeLessThan(96);
    expect(haveBounds?.width).toBeLessThan(160);
    expect(needBounds?.height).toBeLessThan(96);

    expect(result.svg).toContain("flow-node-shell-socket");
    expect(result.svg).toContain('fill="none"');
    expect(result.svg).toContain("A 14 14");

    const assembly = result.graph?.edges.find((edge) => edge.from === "need" && edge.to === "have");
    const routed = result.routing?.edges.find((edge) => edge.edgeId === assembly?.id);
    const tip = routed?.points.at(-1);
    const glyphTop = haveBounds!.y + (haveBounds!.height - 28) / 2;
    expect(tip).toBeTruthy();
    expect(Math.abs(tip!.y - (glyphTop + 14))).toBeLessThan(4);
  });
});
