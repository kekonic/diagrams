import { describe, expect, it } from "vite-plus/test";
import { regionArrange, resolveArrangeGap } from "./region-arrange.ts";

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

  it("resolves gap presets monotonically", () => {
    expect(resolveArrangeGap("compact")).toBeLessThan(resolveArrangeGap("normal"));
    expect(resolveArrangeGap("normal")).toBeLessThan(resolveArrangeGap("spacious"));
    expect(resolveArrangeGap(24)).toBe(24);
  });
});
