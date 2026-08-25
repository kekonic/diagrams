import { describe, expect, it } from "vite-plus/test";
import { parse, compile, projectSemanticGraph, type SemanticGraph } from "../index.ts";

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
    collapse shop as platform: system "Shop platform"
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
    expect(result.layoutHints.direction).toBe("TD");
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
});
