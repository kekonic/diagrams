import { describe, expect, it } from "vite-plus/test";
import { getCapabilities } from "./index.ts";

describe("capability contract", () => {
  it("is deterministic, JSON-safe, and exposes semantic details", () => {
    const first = getCapabilities();
    const second = getCapabilities();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.language.diagramFamilies).toEqual(["flow", "state", "sequence"]);
    expect(first.nodes.find((node) => node.id === "database")).toMatchObject({
      category: "infrastructure",
      capabilities: expect.arrayContaining(["datastore"]),
    });
    expect(first.qualityChecks).toEqual([
      "extreme-aspect-ratio",
      "canvas-spanning-edges",
      "excessive-edge-crossings",
      "reverse-layout-flow",
      "edge-label-pressure",
    ]);
  });
});
