import { describe, expect, it } from "vite-plus/test";
import { parse } from "./parser.ts";
import { compile } from "../compiler/compile.ts";

const SIMPLE = `diagram "Simple" {
  direction LR
  a: service "API"
  b: database "Postgres"
  a -> b "query"
}`;

import { tokenize } from "./lexer.ts";

describe("parser", () => {
  it("parses a first-class state diagram", () => {
    const result = parse(`state "Order" {
      entry: initial "Start"
      pending: state "Pending"
      done: final "Done"
      entry -> pending
      pending -> done "complete"
    }`);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.body[0]).toMatchObject({ type: "Diagram", diagramKind: "state", name: "Order" });
  });

  it("tokenizes edge operator", () => {
    const tokens = tokenize(`a -> b`);
    expect(tokens.some((t) => t.type === "edgeOp")).toBe(true);
  });

  it("tokenizes reverse and bidirectional edge operators", () => {
    for (const op of ["<-", "<=", "<..", "x-", "<->"] as const) {
      const tokens = tokenize(`a ${op} b`);
      expect(tokens.some((t) => t.type === "edgeOp" && t.value === op)).toBe(true);
    }
  });

  it("parses a simple diagram", () => {
    const ast = parse(SIMPLE);
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]?.type).toBe("Diagram");
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("allows omitting the diagram title", () => {
    const ast = parse(`diagram {
  direction LR
  a: service "A"
  b: service "B"
  a -> b
}`);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const diagram = ast.body[0];
    expect(diagram?.type).toBe("Diagram");
    if (diagram?.type !== "Diagram") return;
    expect(diagram.name).toBeUndefined();
    expect(diagram.statements.some((s) => s.type === "Node" && s.id === "a")).toBe(true);

    const compiled = compile(ast);
    expect(compiled.graph.title).toBeUndefined();
    expect(compiled.graph.id).toBe("diagram");
    expect(compiled.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("parses shorthand direction and density directives", () => {
    const ast = parse(`diagram "Hints" {
      direction LR
      density normal
      a: service "A"
    }`);
    const stmts = ast.body[0]?.type === "Diagram" ? ast.body[0].statements : [];
    const direction = stmts.find((s) => s.type === "Directive" && s.name === "direction");
    const density = stmts.find((s) => s.type === "Directive" && s.name === "density");
    expect(direction?.type === "Directive" && direction.value).toBe("LR");
    expect(density?.type === "Directive" && density.value).toBe("normal");

    const compiled = compile(ast);
    expect(compiled.layoutHints.direction).toBe("LR");
    expect(compiled.layoutHints.density).toBe("normal");
  });

  it("parses edge chains", () => {
    const src = `diagram "Chain" {
      a: service "A"
      b: service "B"
      c: service "C"
      a -> b -> c
    }`;
    const ast = parse(src);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const { graph } = compile(ast);
    expect(graph.edges).toHaveLength(2);
    expect(graph.edges.map((e) => `${e.from}->${e.to}`)).toEqual(["a->b", "b->c"]);
  });

  it("reports unknown edge reference at compile time", () => {
    const src = `diagram "Bad" {
      a: service "A"
      a -> missing
    }`;
    const ast = parse(src);
    const result = compile(ast);
    expect(result.diagnostics.some((d) => d.code === "FM104")).toBe(true);
  });

  it("warns on open node kinds", () => {
    const src = `diagram "Open" {
      x: saga "Checkout Saga"
    }`;
    const result = compile(parse(src));
    expect(result.diagnostics.some((d) => d.code === "FM102")).toBe(true);
  });

  it("parses node.column edge endpoints", () => {
    const src = `diagram "Cols" {
      a: table "a" { columns: ["id PK uuid"] }
      b: table "b" { columns: ["id PK uuid", "a_id FK uuid"] }
      a.id -> b.a_id "1:N"
    }`;
    const ast = parse(src);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const diagram = ast.body[0];
    expect(diagram?.type).toBe("Diagram");
    if (diagram?.type !== "Diagram") return;
    const edge = diagram.statements.find((s) => s.type === "Edge");
    expect(edge?.type === "Edge" && edge.fromColumn).toBe("id");
    expect(edge?.type === "Edge" && edge.toColumn).toBe("a_id");
  });

  it("parses structured columns blocks with FK refs and notes", () => {
    const src = `diagram "BlockCols" {
      customers: table "customers" {
        columns {
          id: uuid PK
          email: text UK NN
        }
      }
      orders: table "orders" {
        columns {
          id: uuid PK
          customer_id: uuid FK NN -> customers.id
          status: text NN // pending|paid
        }
      }
    }`;
    const ast = parse(src);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const diagram = ast.body[0];
    expect(diagram?.type).toBe("Diagram");
    if (diagram?.type !== "Diagram") return;
    const orders = diagram.statements.find((s) => s.type === "Node" && s.id === "orders");
    expect(orders?.type).toBe("Node");
    if (orders?.type !== "Node") return;
    const cols = orders.properties.columns;
    expect(Array.isArray(cols)).toBe(true);
    expect(cols).toEqual([
      "id: uuid PK",
      "customer_id: uuid FK NN -> customers.id",
      "status: text NN // pending|paid",
    ]);
  });

  it("parses parameterized types with commas inside columns blocks", () => {
    const src = `diagram "Types" {
      payments: table "payments" {
        columns {
          amount: numeric(10, 2) NN
          email: varchar(320) UK NN
        }
      }
    }`;
    const ast = parse(src);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const diagram = ast.body[0];
    expect(diagram?.type).toBe("Diagram");
    if (diagram?.type !== "Diagram") return;
    const payments = diagram.statements.find((s) => s.type === "Node" && s.id === "payments");
    expect(payments?.type).toBe("Node");
    if (payments?.type !== "Node") return;
    expect(payments.properties.columns).toEqual([
      "amount: numeric(10,2) NN",
      "email: varchar(320) UK NN",
    ]);
  });
});

describe("compiler", () => {
  it("maps edge operators to kinds", () => {
    const src = `diagram "Edges" {
      a: service "A"
      b: service "B"
      c: service "C"
      a -> b
      a => c
    }`;
    const { graph } = compile(parse(src));
    expect(graph.edges.find((e) => e.kind === "sync")).toBeTruthy();
    expect(graph.edges.find((e) => e.kind === "async")).toBeTruthy();
  });

  it("compiles groups with membership", () => {
    const src = `diagram "Groups" {
      group app "App" {
        api: gateway "API"
      }
    }`;
    const { graph } = compile(parse(src));
    expect(graph.groups).toHaveLength(1);
    expect(graph.nodes[0]?.groupId).toBe(graph.groups[0]?.id);
  });

  it("normalizes direction aliases", () => {
    for (const [alias, expected] of [
      ["TB", "TD"],
      ["down", "TD"],
      ["right", "LR"],
      ["BT", "BT"],
    ] as const) {
      const src = `diagram "Dir" {
        direction ${alias}
        a: service "A"
      }`;
      expect(compile(parse(src)).layoutHints.direction).toBe(expected);
    }
  });

  it("applies is-style refs and styles arrays", () => {
    const src = `diagram "Styled" {
      style critical {
        --node-stroke: var(--kd-danger)
        badge: "!"
      }
      checkout: service "Checkout" {
        styles: [critical]
      }
      payment: service "Payment"
      checkout, payment is critical
    }`;
    const { graph } = compile(parse(src));
    expect(graph.styles).toHaveLength(1);
    expect(graph.styles[0]?.properties["--node-stroke"]).toBe("var(--kd-danger)");
    expect(graph.nodes.find((n) => n.id === "checkout")?.styleRefs).toContain("critical");
    expect(graph.nodes.find((n) => n.id === "payment")?.styleRefs).toContain("critical");
  });

  it("applies inline is-style on node declarations", () => {
    const src = `diagram "Inline" {
      deadLetter: dlq "dead-letter" is failed { icon: circle-alert }
      ready: service "Ready" { icon: check } is success
    }`;
    const { graph, diagnostics } = compile(parse(src));
    expect(diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(graph.nodes.find((n) => n.id === "deadLetter")?.styleRefs).toContain("failed");
    expect(graph.nodes.find((n) => n.id === "deadLetter")?.icon).toBe("circle-alert");
    expect(graph.nodes.find((n) => n.id === "ready")?.styleRefs).toContain("success");
  });

  it("parses CSS color values on style custom properties", () => {
    const src = `diagram "Colors" {
      style hot {
        --node-stroke: #f97316
        --node-fill: #431407
      }
      style soft {
        --node-stroke: var(--kd-accent)
        --node-fill: color-mix(in srgb, #0c4a6e 80%, black 20%)
      }
      a: service "A" { styles: [hot] }
      b: service "B" { styles: [soft] }
    }`;
    const { graph } = compile(parse(src));
    const hot = graph.styles.find((s) => s.name === "hot");
    const soft = graph.styles.find((s) => s.name === "soft");
    expect(hot?.properties["--node-stroke"]).toBe("#f97316");
    expect(hot?.properties["--node-fill"]).toBe("#431407");
    expect(soft?.properties["--node-stroke"]).toBe("var(--kd-accent)");
    expect(soft?.properties["--node-fill"]).toBe("color-mix(in srgb, #0c4a6e 80%, black 20%)");
  });

  it("tokenizes hex colors and parentheses", () => {
    const tokens = tokenize(`--node-stroke: #f97316 var(--kd-danger)`);
    expect(tokens.map((t) => t.value)).toEqual([
      "--node-stroke",
      ":",
      "#f97316",
      "var",
      "(",
      "--kd-danger",
      ")",
      "",
    ]);
  });

  it("parses group membership list", () => {
    const src = `diagram "Members" {
      api: gateway "API"
      db: database "DB"
      group app "App" {
        api
      }
      group data "Data" {
        db
      }
    }`;
    const { graph } = compile(parse(src));
    const api = graph.nodes.find((n) => n.id === "api");
    const db = graph.nodes.find((n) => n.id === "db");
    expect(api?.groupId).toBe("app");
    expect(db?.groupId).toBe("data");
  });

  it("parses Lucide / Iconify-style qualified icon ids", () => {
    const src = `diagram "Icons" {
      n: service "API" { icon: lucide:cloud }
      m: service "Cart" { icon: shopping-cart }
      o: icon { icon: logos:aws }
    }`;
    const ast = parse(src);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const diagram = ast.body[0];
    expect(diagram?.type).toBe("Diagram");
    if (diagram?.type !== "Diagram") return;
    const n = diagram.statements.find((s) => s.type === "Node" && s.id === "n");
    const m = diagram.statements.find((s) => s.type === "Node" && s.id === "m");
    const o = diagram.statements.find((s) => s.type === "Node" && s.id === "o");
    expect(n?.type === "Node" && n.properties.icon).toBe("lucide:cloud");
    expect(m?.type === "Node" && m.properties.icon).toBe("shopping-cart");
    expect(o?.type === "Node" && o.properties.icon).toBe("logos:aws");
  });

  it("applies edge style refs", () => {
    const src = `diagram "EdgeStyle" {
      a: service "A"
      b: service "B"
      style bold for edge {
        strokeWidth: 3
      }
      a -> b is bold
    }`;
    const { graph } = compile(parse(src));
    expect(graph.edges[0]?.styleRefs).toContain("bold");
    expect(graph.styles[0]?.target).toBe("edge");
  });
});

describe("soft keywords", () => {
  it("allows reserved words as node ids", () => {
    const ast = parse(`diagram {
      edge: gateway "CDN"
      layout: service "Layout svc"
      edge -> layout
    }`);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const compiled = compile(ast);
    expect(compiled.graph.nodes.some((n) => n.id === "edge")).toBe(true);
    expect(compiled.graph.nodes.some((n) => n.id === "layout")).toBe(true);
  });
});
