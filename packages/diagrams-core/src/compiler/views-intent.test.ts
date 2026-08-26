import { describe, expect, it } from "vite-plus/test";
import {
  parse,
  compile,
  lintViewIntent,
  projectSemanticGraph,
  type SemanticGraph,
} from "../index.ts";

describe("views and intent", () => {
  it("parses intent on a standalone diagram", () => {
    const ast = parse(`diagram "Checkout" {
      intent {
        audience: "Engineers"
        question: "What fails when payment declines?"
      }
      api: gateway "API"
    }`);
    const diagram = ast.body[0];
    expect(diagram?.type).toBe("Diagram");
    if (diagram?.type !== "Diagram") return;
    expect(diagram.statements.some((stmt) => stmt.type === "IntentBlock")).toBe(true);
    const result = compile(ast);
    expect(result.intent?.question).toContain("payment declines");
    expect(result.graph.nodes).toHaveLength(1);
  });

  it("projects include, exclude, and collapse from a shared model", () => {
    const source = `kdiagram 2
model "Shop" {
  customer: person "Customer"
  boundary shop "Shop" {
    web: container "Web"
    api: container "API"
  }
  stripe: external "Stripe"
  customer -> web
  web -> api
  api -> stripe

  view context {
    include customer, shop, stripe
    collapse shop as platform: system "Shop platform" {
      description: "Handles checkout and payment."
    }
    layout { direction: TD }
  }
}`;
    const ast = parse(source);
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
    expect(result.layoutHints.direction).toBe("TD");
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
    expect(result.graph.groups.map((group) => group.id).sort()).toEqual([
      "left",
      "right",
      "shop",
    ]);
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
  customer -> web
  view inside {
    include commerce.*, customer
    exclude api
  }
}`;
    const ast = parse(source);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const result = compile(ast, { view: "inside" });
    expect(result.graph.nodes.map((node) => node.id).sort()).toEqual(["customer", "web"]);
  });

  it("lints intent omits against visible node kinds", () => {
    const graph = {
      id: "g",
      nodes: [
        { id: "db", label: "DB", kind: "database", styleRefs: [] },
        { id: "api", label: "API", kind: "container", styleRefs: [] },
      ],
      edges: [],
      groups: [],
      styles: [],
      animations: [],
      diagnostics: [],
    };
    const range = {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    };
    const diagnostics = lintViewIntent(
      graph,
      { question: "What is shown?", omits: "Internal containers and databases" },
      range,
    );
    expect(diagnostics.map((d) => d.code).sort()).toEqual(["FM231", "FM231"]);
  });

  it("lints scope against visible nodes", () => {
    const graph = {
      id: "g",
      nodes: [
        { id: "a", label: "A", kind: "service", styleRefs: [] },
        { id: "b", label: "B", kind: "service", styleRefs: [] },
      ],
      edges: [],
      groups: [],
      styles: [],
      animations: [],
      diagnostics: [],
    };
    const range = {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    };
    const diagnostics = lintViewIntent(
      graph,
      { question: "What is in scope?", scope: ["a"] },
      range,
    );
    const scopeWarnings = diagnostics.filter((d) => d.code === "FM232");
    expect(scopeWarnings).toHaveLength(1);
    expect(scopeWarnings[0]?.message).toContain('"b"');
  });

  it("collapse summary keeps model-order source range of the collapsed subtree", () => {
    const source = `kdiagram 2
model "Shop" {
  customer: person "Customer"
  boundary shop "Shop" {
    web: container "Web"
  }
  stripe: external "Stripe"
  customer -> web
  web -> stripe
  view context {
    include customer, shop, stripe
    collapse shop as platform: system "Shop"
    layout { direction: TD; considerModelOrder: true }
  }
}`;
    const ast = parse(source);
    const result = compile(ast, { view: "context" });
    const platform = result.graph.nodes.find((node) => node.id === "platform");
    const stripe = result.graph.nodes.find((node) => node.id === "stripe");
    expect(platform?.sourceRange?.start.offset).toBeLessThan(stripe?.sourceRange?.start.offset ?? 0);
  });
});
