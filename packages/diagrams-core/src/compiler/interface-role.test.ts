import { describe, expect, it } from "vite-plus/test";
import { compile, parse } from "../index.ts";

function nodeShape(source: string, id: string): string | undefined {
  const result = compile(parse(source));
  return result.graph.nodes.find((node) => node.id === id)?.shape;
}

describe("interface role", () => {
  it("draws provided and required interfaces as a ball and socket", () => {
    const source = `diagram {
      have: interface "Orders API" { role: provided }
      need: interface "Orders API" { role: required }
      plain: interface "Boxed"
    }`;
    const result = compile(parse(source));
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(nodeShape(source, "have")).toBe("ball");
    expect(nodeShape(source, "need")).toBe("socket");
    expect(nodeShape(source, "plain")).toBe("rounded");
    expect(result.graph.nodes.find((node) => node.id === "have")?.minWidth).toBe(28);
  });

  it("lets an explicit shape win and warns on a bad role", () => {
    const overridden = compile(
      parse(`diagram { api: interface "API" { role: provided shape: rectangle } }`),
    );
    expect(overridden.graph.nodes[0]?.shape).toBe("rectangle");
    expect(overridden.diagnostics.some((d) => d.code === "FM116" || d.code === "FM117")).toBe(
      false,
    );

    const unknown = compile(parse(`diagram { api: interface "API" { role: ball } }`));
    expect(unknown.graph.nodes[0]?.shape).toBe("rounded");
    expect(unknown.diagnostics.some((d) => d.code === "FM116")).toBe(true);

    const service = compile(parse(`diagram { api: service "API" { role: required } }`));
    expect(service.graph.nodes[0]?.shape).not.toBe("socket");
    expect(service.diagnostics.some((d) => d.code === "FM117")).toBe(true);
  });
});
