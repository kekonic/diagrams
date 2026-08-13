import { describe, expect, it } from "vite-plus/test";
import { renderPipeline } from "./pipeline/render.ts";

const SIMPLE = `diagram "Simple" {
  direction LR
  a: service "API"
  b: database "Postgres"
  a -> b "query"
}`;

describe("render pipeline", () => {
  it("renders SVG for a valid diagram", async () => {
    const result = await renderPipeline(SIMPLE);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("API");
    expect(result.stats.layoutAlgorithm).toBe("elk-layered-v1");
    expect(result.stats.routerAlgorithm).toBe("elk-orthogonal-v1");
  });

  it("returns diagnostics on invalid input", async () => {
    const result = await renderPipeline(`diagram "X" { a -> b }`);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
  });

  it("renders untitled diagrams with a default a11y label", async () => {
    const src = `diagram {
  direction LR
  a: service "API"
  b: database "Postgres"
  a -> b
}`;
    const result = await renderPipeline(src);
    expect(result.ok).toBe(true);
    expect(result.graph?.title).toBeUndefined();
    expect(result.svg).toContain('aria-label="Diagram"');
    expect(result.svg).not.toContain("<title");
    expect(result.svg).toContain("API");
  });

  it("uses the authored diagram title as the SVG aria-label", async () => {
    const result = await renderPipeline(SIMPLE);
    expect(result.ok).toBe(true);
    expect(result.svg).toContain('aria-label="Simple"');
    expect(result.svg).not.toContain("<title");
  });
});
