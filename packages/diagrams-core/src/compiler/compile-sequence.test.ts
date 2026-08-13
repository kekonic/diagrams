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

  it("tokenizes --> as return edge op", () => {
    const ast = parse(`sequence { a: participant "A"; b: participant "B"; a --> b "ok" }`);
    const seq = ast.body[0];
    expect(seq?.type).toBe("Sequence");
    if (seq?.type !== "Sequence") return;
    const edge = seq.statements.find((s) => s.type === "Edge");
    expect(edge && edge.type === "Edge" && edge.op).toBe("-->");
  });
});
