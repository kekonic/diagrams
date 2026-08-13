import { describe, expect, it } from "vite-plus/test";
import type { GraphEdge, GraphNode, StyleDefinition } from "@kekonic/diagrams-core";
import {
  resolveNodeStyles,
  resolveEdgeStyles,
  resolveFragmentStyles,
  stylesToInlineCss,
} from "./resolve-styles.ts";

describe("resolveNodeStyles", () => {
  const styles: StyleDefinition[] = [
    {
      name: "critical",
      target: "node",
      properties: { "--accent": "#f00", badge: "!", strokeWidth: "3" },
    },
  ];

  it("merges style refs into css vars and classes", () => {
    const node: GraphNode = {
      id: "n",
      label: "Node",
      kind: "service",
      styleRefs: ["critical"],
      unresolvedVars: { "--base": "blue" },
    };
    const resolved = resolveNodeStyles(node, styles);
    expect(resolved.cssVars["--base"]).toBe("blue");
    expect(resolved.cssVars["--accent"]).toBe("#f00");
    expect(resolved.badge).toBe("!");
    expect(resolved.strokeWidth).toBe(3);
    expect(resolved.classes).toContain("kd-style-critical");
  });

  it("defaults external nodes to dashed strokes", () => {
    const node: GraphNode = {
      id: "ext",
      label: "Vendor",
      kind: "external",
      styleRefs: [],
    };
    expect(resolveNodeStyles(node, styles).strokeDash).toBe("5 3.5");
  });

  it("applies built-in semantic styles without an authored style block", () => {
    const node: GraphNode = {
      id: "n",
      label: "Poison",
      kind: "service",
      styleRefs: ["danger"],
    };
    const resolved = resolveNodeStyles(node, []);
    expect(resolved.cssVars["--node-stroke"]).toBe("var(--kd-danger)");
    expect(resolved.cssVars["--node-fill"]).toBe("var(--kd-danger-fill)");
    expect(resolved.badge).toBe("!");
    expect(resolved.classes).toContain("kd-style-danger");
  });

  it("lets authored styles override builtins of the same name", () => {
    const node: GraphNode = {
      id: "n",
      label: "Custom",
      kind: "service",
      styleRefs: ["danger"],
    };
    const authored: StyleDefinition[] = [
      {
        name: "danger",
        target: "node",
        properties: { "--node-stroke": "#ff00aa", badge: "X" },
      },
    ];
    const resolved = resolveNodeStyles(node, authored);
    expect(resolved.cssVars["--node-stroke"]).toBe("#ff00aa");
    expect(resolved.badge).toBe("X");
  });

  it("resolves aliases like fail → danger palette", () => {
    const node: GraphNode = {
      id: "n",
      label: "Down",
      kind: "service",
      styleRefs: ["fail"],
    };
    const resolved = resolveNodeStyles(node, []);
    expect(resolved.cssVars["--node-stroke"]).toBe("var(--kd-danger)");
    expect(resolved.badge).toBe("!");
  });
});

describe("resolveEdgeStyles", () => {
  it("applies edge-targeted style definitions", () => {
    const styles: StyleDefinition[] = [
      {
        name: "slow",
        target: "edge",
        properties: { strokeDash: "4 4", strokeWidth: "2", "--edge-color": "orange" },
      },
    ];
    const edge: GraphEdge = {
      id: "e1",
      from: "a",
      to: "b",
      kind: "dependency",
      styleRefs: ["slow"],
    };
    const resolved = resolveEdgeStyles(edge, styles);
    expect(resolved.strokeDash).toBe("4 4");
    expect(resolved.strokeWidth).toBe(2);
    expect(resolved.cssVars["--edge-color"]).toBe("orange");
    expect(resolved.classes).toContain("kd-style-slow");
  });

  it("applies built-in edge semantic styles", () => {
    const edge: GraphEdge = {
      id: "e1",
      from: "a",
      to: "b",
      kind: "sync",
      styleRefs: ["danger"],
    };
    const resolved = resolveEdgeStyles(edge, []);
    expect(resolved.cssVars["--edge-stroke"]).toBe("var(--kd-danger)");
    expect(resolved.strokeWidth).toBe(2.4);
  });
});

describe("resolveFragmentStyles", () => {
  it("applies built-in semantic fragment styles", () => {
    const resolved = resolveFragmentStyles({ styleRefs: ["danger"], unresolvedVars: {} }, []);
    expect(resolved.classes).toContain("kd-style-danger");
    expect(resolved.cssVars["--kd-sequence-fragment-fill"]).toContain("kd-danger");
    expect(resolved.cssVars["--kd-sequence-fragment-stroke"]).toContain("kd-danger");
  });

  it("maps fill/stroke shorthands from authored fragment styles", () => {
    const styles: StyleDefinition[] = [
      {
        name: "hot",
        target: "fragment",
        properties: { fill: "#3b1d1d", stroke: "#c53637" },
      },
    ];
    const resolved = resolveFragmentStyles({ styleRefs: ["hot"], unresolvedVars: {} }, styles);
    expect(resolved.cssVars["--kd-sequence-fragment-fill"]).toBe("#3b1d1d");
    expect(resolved.cssVars["--kd-sequence-fragment-stroke"]).toBe("#c53637");
    expect(resolved.classes).toContain("kd-style-hot");
  });
});

describe("stylesToInlineCss", () => {
  it("joins css custom properties for inline style attributes", () => {
    expect(stylesToInlineCss({ "--a": "1", "--b": "red" })).toBe("--a: 1; --b: red");
  });
});
