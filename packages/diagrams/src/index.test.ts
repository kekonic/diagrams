import { describe, expect, it } from "vite-plus/test";
import { KDiagram } from "./index.ts";

describe("KDiagram API", () => {
  it("exports parse, compile, renderToSvg", async () => {
    const src = `diagram "T" { a: service "A" }`;
    expect(KDiagram.parse(src).ast.body).toHaveLength(1);
    expect(KDiagram.compile(src).graph.nodes).toHaveLength(1);
    const result = await KDiagram.renderToSvg(src);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain("svg");
  });

  it("formats source via format()", () => {
    const src = `diagram "T" {\na: service "A"\n}`;
    const formatted = KDiagram.format(src);
    expect(formatted).toContain('  a: service "A"');
  });
});
