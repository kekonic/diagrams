import { describe, expect, it } from "vite-plus/test";
import { nodeNavigationTarget } from "./nodeNavigation.ts";

describe("node source navigation", () => {
  const start = { id: 7, x: 100, y: 100, nodeId: "checkout" };

  it("navigates for a stationary click", () => {
    expect(nodeNavigationTarget(start, { id: 7, x: 103, y: 102 })).toBe("checkout");
  });

  it("does not navigate after panning", () => {
    expect(nodeNavigationTarget(start, { id: 7, x: 120, y: 115 })).toBeNull();
  });

  it("does not reuse a different pointer gesture", () => {
    expect(nodeNavigationTarget(start, { id: 8, x: 100, y: 100 })).toBeNull();
  });
});
