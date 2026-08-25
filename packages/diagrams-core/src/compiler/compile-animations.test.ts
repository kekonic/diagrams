import { describe, expect, it } from "vite-plus/test";
import { parse } from "../parser/parser.ts";
import { compile } from "./compile.ts";
import { formatSource } from "../format/print.ts";

const SRC = `
diagram "Anim" {
  a: service "A"
  b: choice "B?"
  c: success "C"
  a -> b
  b -> c

  animation "Denied" {
    dim *
    activate a
    flow a -> b -> c for 1.5s
    pulse b for 400ms
    wait 800ms
    loop
  }
}
`;

describe("animation DSL", () => {
  it("parses and compiles animation blocks", () => {
    const ast = parse(SRC);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const diagram = ast.body[0];
    expect(diagram?.type).toBe("Diagram");
    if (diagram?.type !== "Diagram") return;
    const block = diagram.statements.find((statement) => statement.type === "AnimationBlock");
    expect(block?.type).toBe("AnimationBlock");
    if (block?.type !== "AnimationBlock") return;
    expect(block.name).toBe("Denied");
    expect(block.cues.some((cue) => cue.type === "loop")).toBe(true);

    const result = compile(ast);
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(result.graph.animations).toHaveLength(1);
    const anim = result.graph.animations![0]!;
    expect(anim.id).toBe("denied");
    expect(anim.source).toBe("authored");
    expect(anim.loop).toBe(true);
    expect(anim.cues[0]).toEqual({ op: "dim", targets: [{ type: "all" }] });
    expect(anim.cues.some((c) => c.op === "flow" && c.durationMs === 1500)).toBe(true);
  });

  it("reports unknown node ids", () => {
    const ast = parse(`diagram {
      a: service "A"
      animation "X" {
        activate missing
      }
    }`);
    const result = compile(ast);
    expect(result.diagnostics.some((d) => d.code === "FM128")).toBe(true);
  });

  it("round-trips through the formatter", () => {
    const formatted = formatSource(SRC);
    expect(formatted).toContain('animation "Denied"');
    expect(formatted).toContain("flow a -> b -> c for 1.5s");
    const again = formatSource(formatted);
    expect(again).toBe(formatted);
  });

  it("treats an empty animation block as opt-in Automatic", () => {
    const result = compile(
      parse(`diagram {
      a: service "A"
      b: service "B"
      a -> b
      animation "Automatic" {}
    }`),
    );
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(result.graph.animations).toEqual([
      { id: "automatic", name: "Automatic", loop: false, cues: [], source: "auto" },
    ]);
  });

  it("compiles parallel cue groups", () => {
    const result = compile(
      parse(`diagram {
      a: service "A"
      b: service "B"
      c: service "C"
      a -> b
      a -> c
      animation "Fan" {
        parallel {
          flow a -> b for 500ms
          flow a -> c for 700ms
        }
        activate b, c
      }
    }`),
    );
    expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const anim = result.graph.animations![0]!;
    expect(anim.cues[0]).toEqual({
      op: "parallel",
      cues: [
        { op: "flow", path: ["a", "b"], durationMs: 500 },
        { op: "flow", path: ["a", "c"], durationMs: 700 },
      ],
    });
  });

  it("errors FM129 for loop inside parallel and FM130 for nested parallel", () => {
    const result = compile(
      parse(`diagram {
      a: service "A"
      b: service "B"
      a -> b
      animation "Bad" {
        parallel {
          loop
          flow a -> b for 200ms
          parallel {
            flow a -> b for 200ms
          }
        }
      }
    }`),
    );
    expect(result.diagnostics.some((d) => d.code === "FM129" && d.severity === "error")).toBe(true);
    expect(result.diagnostics.some((d) => d.code === "FM130" && d.severity === "error")).toBe(true);
  });
});
