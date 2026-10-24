import { describe, expect, it } from "vite-plus/test";
import { parse } from "../parser/index.ts";
import { compile } from "./compile.ts";

describe("sequence compile", () => {
  it("parses and compiles a basic sequence with return and alternate", () => {
    const src = `
sequence "Checkout" {
  autonumber
  user: actor "Shopper"
  api: participant "API"
  db: service "DB"

  user -> api "POST"
  activate api
  api -> db "INSERT"
  db --> api "row"
  api --> user "201"
  deactivate api

  alternate "ok" {
    api -> user "confirm"
  } else "fail" {
    api -x user "402"
  }

  note over api, db "Persist"
}
`;
    const ast = parse(src);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(ast.body[0]?.type).toBe("Sequence");

    const result = compile(ast);
    expect(result.graph.diagramKind).toBe("sequence");
    expect(result.graph.sequence).toBeDefined();
    const seq = result.graph.sequence!;
    expect(seq.autonumber).toBe(true);
    expect(seq.participantOrder).toEqual(["user", "api", "db"]);
    expect(seq.messages.some((m) => m.kind === "return")).toBe(true);
    expect(seq.fragments).toHaveLength(1);
    expect(seq.fragments[0]?.operator).toBe("alternate");
    expect(seq.fragments[0]?.operands).toHaveLength(2);
    expect(seq.notes).toHaveLength(1);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("accepts Mermaid-style fragment aliases (alt/par/opt/group)", () => {
    const src = `
sequence {
  a: participant "A"
  b: participant "B"
  alt "x" {
    a -> b "yes"
  } else "y" {
    a -x b "no"
  }
  par "p" {
    a -> b "1"
  } and "q" {
    a -> b "2"
  }
  opt "o" {
    a -> b "maybe"
  }
  group "g" {
    a -> b "boxed"
  }
}
`;
    const result = compile(parse(src));
    const ops = result.graph.sequence?.fragments.map((f) => f.operator) ?? [];
    expect(ops).toEqual(["alternate", "parallel", "optional", "section"]);
  });

  it("applies semantic and authored styles to fragments", () => {
    const src = `
sequence {
  a: participant "A"
  b: participant "B"
  style hot for fragment {
    fill: "#3b1d1d"
    stroke: "#c53637"
  }
  alternate "ok" is success {
    a -> b "yes"
  } else "no" is danger {
    a -x b "no"
  }
  section "Legacy" is hot {
    a -> b "call"
  }
}
`;
    const result = compile(parse(src));
    const frags = result.graph.sequence?.fragments ?? [];
    expect(frags[0]?.operator).toBe("alternate");
    expect(frags[0]?.styleRefs).toEqual(["success"]);
    expect(frags[0]?.operands[0]?.styleRefs).toEqual(["success"]);
    expect(frags[0]?.operands[1]?.styleRefs).toEqual(["danger"]);
    expect(frags[1]?.styleRefs).toEqual(["hot"]);
    expect(result.graph.styles.some((s) => s.name === "hot" && s.target === "fragment")).toBe(true);
  });

  it("collapses a repeated activate on the same message and hugs self calls", () => {
    const src = `
sequence {
  a: participant "A"
  b: participant "B"
  a -> b "call"
  activate b
  b -> b "again"
  b --> a "done"
}
`;
    const seq = compile(parse(src)).graph.sequence!;
    const onB = seq.activations.filter((act) => act.participantId === "b");
    const self = onB.find((act) => act.startOrder === act.endOrder);
    const outer = onB.find((act) => act.startOrder !== act.endOrder);
    expect(onB).toHaveLength(2);
    expect(self?.startOrder).toBe(1);
    expect(outer?.startOrder).toBe(0);
    expect(outer?.endOrder).toBeGreaterThan(self?.endOrder ?? 0);
  });

  it("keeps a payload excerpt on the message and the call name on the label", () => {
    const src = [
      "sequence {",
      '  a: participant "A"',
      '  b: participant "B"',
      '  a -> b "POST /checkout" {',
      '    payload: """',
      "    {",
      '      "cartId": "c_91"',
      "    }",
      '    """',
      "  }",
      '  a => b "AuthorizeRequested" {',
      '    payload: """',
      "    {",
      '      "amount": 4200',
      "    }",
      '    """',
      "  }",
      "}",
    ].join("\n");
    const result = compile(parse(src));
    expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    const [call, event] = result.graph.sequence?.messages ?? [];
    expect(call?.label).toBe("POST /checkout");
    expect(call?.kind).toBe("sync");
    expect(call?.payload).toBe('{\n  "cartId": "c_91"\n}');
    expect(event?.kind).toBe("async");
    expect(event?.payload).toContain('"amount": 4200');
    expect(result.graph.edges.find((edge) => edge.label === "AuthorizeRequested")?.kind).toBe(
      "async",
    );
    expect(result.graph.edges.map((edge) => edge.label)).toEqual([
      "POST /checkout",
      "AuthorizeRequested",
    ]);
    expect(result.graph.edges.every((edge) => !edge.label?.includes("cartId"))).toBe(true);
  });

  it("omits an empty payload and warns when the excerpt is not a string or is too long", () => {
    const src = `
sequence {
  a: participant "A"
  b: participant "B"
  a -> b "empty" { payload: "  " }
  a -> b "number" { payload: 12 }
  a => b "long" {
    payload: "one
two
three
four
five
six
seven"
  }
}
`;
    const result = compile(parse(src));
    const messages = result.graph.sequence?.messages ?? [];
    expect(messages[0]?.payload).toBeUndefined();
    expect(messages[1]?.payload).toBeUndefined();
    expect(messages[2]?.kind).toBe("async");
    expect(messages[2]?.payload?.split("\n")).toHaveLength(7);
    expect(messages[2]?.label).toBe("long");
    const warnings = result.diagnostics.filter((item) => item.code === "FM148");
    expect(warnings.map((item) => item.message)).toEqual([
      "Sequence payload must be a string excerpt",
      "Sequence payload is 7 lines; the excerpt will be shortened to 6",
    ]);
    expect(warnings.every((item) => item.range != null)).toBe(true);
  });

  it("keeps an eventual signal distinct from an async handoff", () => {
    const src = `
sequence {
  orders: service "Orders"
  topic: topic "orders"
  readModel: service "Read model"
  orders => topic "OrderPlaced"
  topic ~> readModel "caught up"
}
`;
    const result = compile(parse(src));
    expect(result.diagnostics.filter((item) => item.severity === "error")).toEqual([]);
    const messages = result.graph.sequence?.messages ?? [];
    expect(messages.map((message) => message.kind)).toEqual(["async", "eventual"]);
    expect(result.graph.edges.map((edge) => edge.kind)).toEqual(["async", "eventual"]);
  });

  it("tokenizes --> as return edge op", () => {
    const ast = parse(`sequence { a: participant "A"; b: participant "B"; a --> b "ok" }`);
    const seq = ast.body[0];
    expect(seq?.type).toBe("Sequence");
    if (seq?.type !== "Sequence") return;
    const edge = seq.statements.find((s) => s.type === "Edge");
    expect(edge && edge.type === "Edge" && edge.op).toBe("-->");
  });
});
