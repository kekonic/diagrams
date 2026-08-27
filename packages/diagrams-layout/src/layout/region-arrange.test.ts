import { describe, expect, it } from "vite-plus/test";
import { regionArrange, regionArrangeSurround, resolveArrangeGap } from "./region-arrange.ts";

describe("regionArrange", () => {
  it("stacks with stretch equalizing widths", () => {
    const out = regionArrange({
      arrange: "stack",
      align: "stretch",
      gap: 10,
      cells: [
        { groupId: "a", width: 100, height: 40 },
        { groupId: "b", width: 160, height: 50 },
        { groupId: "c", width: 120, height: 40 },
      ],
    });
    expect(out).toHaveLength(3);
    expect(out.every((r) => r.bounds.width === 160)).toBe(true);
    expect(out[0]!.bounds.y).toBe(0);
    expect(out[1]!.bounds.y).toBe(50);
    expect(out[2]!.bounds.y).toBe(110);
    expect(out[0]!.bounds.x).toBe(0);
  });

  it("rows with stretch equalizing heights", () => {
    const out = regionArrange({
      arrange: "row",
      align: "stretch",
      gap: 8,
      cells: [
        { groupId: "a", width: 80, height: 40 },
        { groupId: "b", width: 90, height: 70 },
      ],
    });
    expect(out.every((r) => r.bounds.height === 70)).toBe(true);
    expect(out[0]!.bounds.x).toBe(0);
    expect(out[1]!.bounds.x).toBe(88);
  });

  it("grid places named columns and rowSpan", () => {
    const out = regionArrange({
      arrange: "grid",
      align: "stretch",
      gap: 10,
      columns: ["edge", "core", "data"],
      rows: 2,
      cells: [
        { groupId: "edge", width: 80, height: 40, column: "edge" },
        { groupId: "core", width: 100, height: 40, column: "core", rowSpan: 2 },
        { groupId: "data", width: 80, height: 40, column: "data" },
        { groupId: "ops", width: 80, height: 40, column: "edge", row: 2 },
        { groupId: "obs", width: 80, height: 40, column: "data", row: 2 },
      ],
    });
    const byId = Object.fromEntries(out.map((r) => [r.groupId, r.bounds]));
    expect(byId.core!.height).toBeGreaterThan(byId.edge!.height);
    expect(byId.edge!.x).toBeLessThan(byId.core!.x);
    expect(byId.core!.x).toBeLessThan(byId.data!.x);
    expect(byId.ops!.y).toBeGreaterThan(byId.edge!.y);
    // Shared left edge for edge/ops column
    expect(byId.edge!.x).toBe(byId.ops!.x);
  });

  it("grid grows row tracks when a cell cites row without rows declared", () => {
    const out = regionArrange({
      arrange: "grid",
      align: "stretch",
      gap: 10,
      columns: 2,
      cells: [
        { groupId: "people", width: 120, height: 80 },
        { groupId: "lucide", width: 120, height: 80 },
        { groupId: "brands", width: 120, height: 80, column: 1, row: 2 },
      ],
    });
    const byId = Object.fromEntries(out.map((r) => [r.groupId, r.bounds]));
    expect(byId.people!.y).toBeLessThan(byId.brands!.y);
    expect(byId.people!.x).toBe(byId.brands!.x);
    expect(byId.lucide!.y).toBe(byId.people!.y);
    expect(byId.lucide!.x).toBeGreaterThan(byId.people!.x);
  });

  it("resolves gap presets monotonically", () => {
    expect(resolveArrangeGap("compact")).toBeLessThan(resolveArrangeGap("normal"));
    expect(resolveArrangeGap("normal")).toBeLessThan(resolveArrangeGap("spacious"));
    expect(resolveArrangeGap(24)).toBe(24);
  });
});

describe("regionArrangeSurround", () => {
  it("centers the hub and puts west/east satellites on opposite sides", () => {
    const out = regionArrangeSurround({
      hub: { width: 100, height: 80 },
      gap: 20,
      satellites: [
        { id: "in", width: 60, height: 40, side: "west" },
        { id: "out", width: 60, height: 40, side: "east" },
      ],
    });
    expect(out.hub.width).toBe(100);
    expect(out.satellites).toHaveLength(2);
    const west = out.satellites.find((s) => s.groupId === "in")!.bounds;
    const east = out.satellites.find((s) => s.groupId === "out")!.bounds;
    expect(west.x + west.width).toBeLessThan(out.hub.x);
    expect(east.x).toBeGreaterThan(out.hub.x + out.hub.width);
    expect(out.contentBounds.width).toBeGreaterThan(out.hub.width);
  });
});
