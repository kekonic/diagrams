import { describe, expect, it } from "vite-plus/test";
import type { GraphModel } from "@kekonic/diagrams-core";
import {
  applySwimlaneBands,
  resolveSwimlaneLayoutOptions,
  wrapSwimlaneHeaderLabel,
} from "./swimlane-bands.ts";
import {
  SWIMLANE_HEADER_PAD_LEFT,
  SWIMLANE_HEADER_PAD_RIGHT,
  SWIMLANE_HEADER_WIDTH,
} from "./constants.ts";
import type { LaidOutGroup, LaidOutNode } from "./types.ts";

function graph(): GraphModel {
  return {
    id: "lanes",
    nodes: [
      { id: "a", label: "A", kind: "task", styleRefs: [], groupId: "employee" },
      { id: "b", label: "B", kind: "task", styleRefs: [], groupId: "manager" },
    ],
    edges: [{ id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] }],
    groups: [
      {
        id: "employee",
        label: "Employee",
        kind: "swimlane",
        nodeIds: ["a"],
        childGroupIds: [],
        styleRefs: [],
      },
      {
        id: "manager",
        label: "Manager",
        kind: "swimlane",
        nodeIds: ["b"],
        childGroupIds: [],
        styleRefs: [],
      },
    ],
    styles: [],
    diagnostics: [],
  };
}

function lane(
  id: string,
  bounds: { x: number; y: number; width: number; height: number },
): LaidOutGroup {
  return {
    groupId: id,
    bounds,
    labelBox: { x: bounds.x + 14, y: bounds.y + 10, width: 80, height: 19 },
    padding: { top: 56, right: 40, bottom: 40, left: 40 },
  };
}

describe("swimlane bands", () => {
  it("resolves swimlane groupLayout and LR unless the author set flat", () => {
    const resolved = resolveSwimlaneLayoutOptions(graph(), { groupLayout: "compound" });
    expect(resolved.groupLayout).toBe("swimlane");
    expect(resolved.direction).toBe("LR");
    expect(resolveSwimlaneLayoutOptions(graph(), { groupLayout: "flat" }).groupLayout).toBe("flat");
  });

  it("shares band width and places a left header strip", () => {
    const nodes: LaidOutNode[] = [
      { nodeId: "a", bounds: { x: 180, y: 80, width: 120, height: 48 }, rank: 0, order: 0 },
      { nodeId: "b", bounds: { x: 320, y: 220, width: 100, height: 48 }, rank: 1, order: 0 },
    ];
    const groups = [
      lane("employee", { x: 140, y: 40, width: 200, height: 128 }),
      lane("manager", { x: 200, y: 180, width: 260, height: 128 }),
    ];
    const result = applySwimlaneBands(graph(), nodes, groups);
    const employee = result.groups.find((item) => item.groupId === "employee")!;
    const manager = result.groups.find((item) => item.groupId === "manager")!;
    expect(employee.bounds.x).toBe(manager.bounds.x);
    expect(employee.bounds.width).toBe(manager.bounds.width);
    expect(employee.headerBox?.width).toBe(SWIMLANE_HEADER_WIDTH);
    expect(employee.headerBox?.x).toBe(employee.bounds.x);
    expect(employee.headerBox?.height).toBe(employee.bounds.height);
    expect(employee.labelBox.x).toBe(employee.headerBox!.x + SWIMLANE_HEADER_PAD_LEFT);
    expect(employee.labelBox.x + employee.labelBox.width).toBe(
      employee.headerBox!.x + employee.headerBox!.width - SWIMLANE_HEADER_PAD_RIGHT,
    );
    expect(manager.bounds.x).toBeGreaterThanOrEqual(64);
  });

  it("tiles bands with no gap and keeps members inside their lane", () => {
    const nodes: LaidOutNode[] = [
      { nodeId: "a", bounds: { x: 180, y: 80, width: 120, height: 48 }, rank: 0, order: 0 },
      { nodeId: "b", bounds: { x: 320, y: 280, width: 100, height: 48 }, rank: 1, order: 0 },
    ];
    const groups = [
      lane("employee", { x: 140, y: 40, width: 400, height: 128 }),
      lane("manager", { x: 140, y: 220, width: 400, height: 128 }),
    ];
    const result = applySwimlaneBands(graph(), nodes, groups);
    const employee = result.groups.find((item) => item.groupId === "employee")!;
    const manager = result.groups.find((item) => item.groupId === "manager")!;
    expect(employee.bounds.y + employee.bounds.height).toBeCloseTo(manager.bounds.y, 0);
    const a = result.nodes.find((item) => item.nodeId === "a")!;
    const b = result.nodes.find((item) => item.nodeId === "b")!;
    expect(a.bounds.y).toBeGreaterThanOrEqual(employee.bounds.y);
    expect(a.bounds.y + a.bounds.height).toBeLessThanOrEqual(
      employee.bounds.y + employee.bounds.height,
    );
    expect(b.bounds.y).toBeGreaterThanOrEqual(manager.bounds.y);
    expect(b.bounds.y + b.bounds.height).toBeLessThanOrEqual(
      manager.bounds.y + manager.bounds.height,
    );
    expect(a.bounds.x).toBeLessThan(b.bounds.x);
  });

  it("preserves declaration order of lane ids", () => {
    const groups = [
      lane("manager", { x: 140, y: 180, width: 200, height: 100 }),
      lane("employee", { x: 140, y: 40, width: 200, height: 100 }),
    ];
    const result = applySwimlaneBands(graph(), [], groups);
    expect(result.groups.map((item) => item.groupId)).toEqual(["manager", "employee"]);
    expect(result.groups[0]!.headerBox).toBeTruthy();
    expect(result.groups[1]!.headerBox).toBeTruthy();
  });

  it("wraps long header titles before they reach the header rule", () => {
    expect(wrapSwimlaneHeaderLabel("Employee", 98)).toEqual(["Employee"]);
    expect(wrapSwimlaneHeaderLabel("Automated controls", 98)).toEqual(["Automated", "controls"]);
  });
});
