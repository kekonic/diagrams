import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { renderPipeline } from "./pipeline/render.ts";

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), "../../../examples");

function load(name: string): string {
  return readFileSync(join(EXAMPLES, name), "utf8");
}

describe("new corpus examples — render gates", () => {
  it("renders expense-approval swimlanes with header chrome", async () => {
    const result = await renderPipeline(load("expense-approval.kdiagram"));
    expect(result.ok).toBe(true);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.graph!.groups.filter((g) => g.kind === "swimlane").map((g) => g.id)).toEqual([
      "employee",
      "controls",
      "manager",
    ]);
    expect(result.graph!.animations?.some((a) => a.name === "Needs correction")).toBe(true);
    const lanes = result.layout!.groups.filter((g) =>
      ["employee", "controls", "manager"].includes(g.groupId),
    );
    expect(lanes).toHaveLength(3);
    const widths = new Set(lanes.map((g) => g.bounds.width));
    const lefts = new Set(lanes.map((g) => g.bounds.x));
    expect(widths.size).toBe(1);
    expect(lefts.size).toBe(1);
    expect(lanes.every((g) => g.headerBox != null)).toBe(true);
    expect(lanes[0]!.headerBox!.width).toBeGreaterThan(0);
    expect(lanes[0]!.headerBox!.x).toBe(lanes[0]!.bounds.x);
    const ordered = [...lanes].sort((a, b) => a.bounds.y - b.bounds.y);
    expect(ordered.map((lane) => lane.groupId)).toEqual(["employee", "controls", "manager"]);
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1]!;
      const next = ordered[i]!;
      expect(prev.bounds.y + prev.bounds.height).toBeCloseTo(next.bounds.y, 0);
    }
    const xOf = (id: string) => result.layout!.nodes.find((node) => node.nodeId === id)!.bounds.x;
    expect(xOf("submit")).toBeLessThan(xOf("validate"));
    expect(xOf("validate")).toBeLessThan(xOf("approve"));
    expect(xOf("approve")).toBeLessThan(xOf("paid"));
    expect(xOf("submit")).toBeLessThan(xOf("correct"));
    const bandLeft = ordered[0]!.bounds.x;
    const bandRight = ordered[0]!.bounds.x + ordered[0]!.bounds.width;
    const pathOf = (from: string, to: string) => {
      const edge = result.graph!.edges.find((item) => item.from === from && item.to === to);
      expect(edge, `${from}->${to}`).toBeTruthy();
      return result.layout!.edgePaths.find((path) => path.edgeId === edge!.id)!;
    };
    const rejectCorrect = pathOf("reject", "correct");
    const validateCorrect = pathOf("validate", "correct");
    const minX = (path: { points: Array<{ x: number }> }) =>
      Math.min(...path.points.map((p) => p.x));
    const maxX = (path: { points: Array<{ x: number }> }) =>
      Math.max(...path.points.map((p) => p.x));
    expect(minX(rejectCorrect)).toBeGreaterThanOrEqual(bandLeft - 1);
    expect(minX(validateCorrect)).toBeGreaterThanOrEqual(bandLeft - 1);
    expect(maxX(rejectCorrect)).toBeLessThanOrEqual(bandRight + 8);
    expect(result.svg).toContain("flow-group-swimlane");
    expect(result.svg).toContain("flow-group-header-bar");
    expect(result.svg).toContain("flow-group-swimlane-sep");
    expect(result.svg).not.toContain("flow-group-header-accent");
    expect(result.svg).not.toMatch(/flow-group-swimlane[\s\S]*?class="flow-group-box"/);
    expect(result.svg).toContain(">Automated</tspan>");
    expect(result.svg).toContain(">controls</tspan>");
  });

  it("renders order-fulfillment groups as outlines without stacked fills", async () => {
    const result = await renderPipeline(load("order-fulfillment.kdiagram"));
    expect(result.ok).toBe(true);
    const boxes = result.svg!.match(/class="flow-group-box"[^>]*/g) ?? [];
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every((box) => box.includes('fill="none"'))).toBe(true);
    expect(result.svg).not.toContain('class="flow-group flow-group-accented"');
  });

  it("keeps labeled order-lifecycle finals readable on the node fill", async () => {
    const result = await renderPipeline(load("order-lifecycle.kdiagram"));
    expect(result.ok).toBe(true);
    expect(result.svg).toContain("flow-state-final-ring");
    expect(result.svg).toContain(">Cancelled</text>");
    expect(result.svg).toContain(">Shipped</text>");
    expect(result.svg).toContain(">Abandoned</text>");
    expect(result.svg).not.toContain("flow-state-final-core");
  });

  for (const file of [
    "order-event-storm.kdiagram",
    "commerce-context-map.kdiagram",
    "order-aggregate.kdiagram",
  ] as const) {
    it(`renders ${file} without errors`, async () => {
      const result = await renderPipeline(load(file));
      expect(
        result.diagnostics.filter((d) => d.severity === "error").map((d) => d.message),
        file,
      ).toEqual([]);
      expect(result.ok, file).toBe(true);
      expect(
        result.diagnostics.filter((d) => d.severity === "error"),
        file,
      ).toHaveLength(0);
      expect(result.graph!.animations?.length ?? 0).toBeGreaterThan(0);
      expect(result.layout).toBeTruthy();
    });
  }
});
