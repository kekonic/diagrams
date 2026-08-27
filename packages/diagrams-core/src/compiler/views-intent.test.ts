import { describe, expect, it } from "vite-plus/test";
import { parse, compile, projectSemanticGraph, type SemanticGraph } from "../index.ts";

describe("model views", () => {
  it("projects include/exclude and compiles view-local edges", () => {
    const source = `kdiagram 2
model "Shop" {
  customer: person "Customer"
  platform: system "Shop platform" {
    description: "Handles checkout and payment."
  }
  boundary shop "Shop" {
    web: container "Web"
    api: container "API"
  }
  stripe: external "Stripe"

  view context {
    include customer, platform, stripe
    customer -> platform
    platform -> stripe
    layout { direction: TD }
  }
}`;
    const ast = parse(source);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const result = compile(ast, { view: "context" });
    expect(result.graph.view?.name).toBe("context");
    expect(result.graph.nodes.map((node) => node.id).sort()).toEqual([
      "customer",
      "platform",
      "stripe",
    ]);
    expect(result.graph.nodes.find((node) => node.id === "platform")?.description).toBe(
      "Handles checkout and payment.",
    );
    expect(result.graph.edges).toHaveLength(2);
    expect(result.layoutHints.direction).toBe("TD");
  });

  it("rejects edges in the model body", () => {
    const source = `kdiagram 2
model "Shop" {
  a: service "A"
  b: service "B"
  a -> b
  view main {
    include a, b
  }
}`;
    const ast = parse(source);
    expect(ast.diagnostics.some((d) => d.code === "FM222")).toBe(true);
  });

  it("prefers default then main when --view is omitted", () => {
    const source = `kdiagram 2
model "Shop" {
  a: service "A"
  b: service "B"
  view other {
    include a
  }
  view main {
    include b
  }
}`;
    const result = compile(parse(source));
    expect(result.graph.view?.name).toBe("main");
    expect(result.graph.nodes.map((node) => node.id)).toEqual(["b"]);
  });

  it("keeps parent boundaries that only contain child zones", () => {
    const source = `kdiagram 2
model "Shop" {
  boundary shop "Shop" {
    arrange: grid
    columns: 2
    zone left {
      column: 1
      web: container "Web"
    }
    zone right {
      column: 2
      api: container "API"
    }
  }
  view containers {
    include shop.*
  }
}`;
    const ast = parse(source);
    const result = compile(ast, { view: "containers" });
    expect(result.graph.groups.map((group) => group.id).sort()).toEqual(["left", "right", "shop"]);
    expect(result.graph.groups.find((group) => group.id === "shop")?.childGroupIds.sort()).toEqual([
      "left",
      "right",
    ]);
  });

  it("matches wildcard selectors against group members", () => {
    const semantic: SemanticGraph = {
      id: "m",
      diagramKind: "flow",
      nodes: [
        { id: "a", label: "A", kind: "service", styleRefs: [] },
        { id: "b", label: "B", kind: "service", styleRefs: [], groupId: "g" },
      ],
      edges: [{ id: "e1", from: "a", to: "b", kind: "sync", styleRefs: [] }],
      groups: [
        { id: "g", label: "G", kind: "group", nodeIds: ["b"], childGroupIds: [], styleRefs: [] },
      ],
      styles: [],
      diagnostics: [],
    };
    const projected = projectSemanticGraph(
      semantic,
      [
        {
          type: "Include",
          selectors: ["g.*"],
          range: semantic.nodes[0]!.sourceRange ?? {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 1, offset: 0 },
          },
        },
      ],
      {
        viewName: "inside",
        modelId: "m",
        range: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
      },
    );
    expect(projected.nodes.map((node) => node.id)).toEqual(["b"]);
  });

  it("parses wildcard selectors in include lists", () => {
    const source = `kdiagram 2
model "Shop" {
  boundary commerce "Commerce" {
    web: container "Web"
    api: container "API"
  }
  customer: person "Customer"
  view inside {
    include commerce.*, customer
    exclude api
    customer -> web
  }
}`;
    const ast = parse(source);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const result = compile(ast, { view: "inside" });
    expect(result.graph.nodes.map((node) => node.id).sort()).toEqual(["customer", "web"]);
  });

  it("warns on unresolved include selectors", () => {
    const source = `kdiagram 2
model "Shop" {
  customer: person "Customer"
  view context {
    include customer, missingActor
  }
}`;
    const result = compile(parse(source), { view: "context" });
    expect(result.diagnostics.some((d) => d.code === "FM233")).toBe(true);
  });
});
