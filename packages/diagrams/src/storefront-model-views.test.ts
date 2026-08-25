import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { renderPipeline } from "./pipeline/render.ts";

const EXAMPLE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../examples/storefront-model.kdiagram",
);

describe("storefront-model views — render gates", () => {
  const source = readFileSync(EXAMPLE, "utf8");
  const renderOptions = {
    sourcePath: EXAMPLE,
    readFile: (path: string) => readFileSync(path, "utf8"),
  };

  for (const view of ["context", "containers"] as const) {
    it(`renders ${view} without errors`, async () => {
      const result = await renderPipeline(source, { ...renderOptions, view });

      expect(result.ok, `${view} ok`).toBe(true);
      expect(
        result.diagnostics.filter((d) => d.severity === "error"),
        `${view} errors`,
      ).toHaveLength(0);
      expect(result.layout, `${view} layout`).toBeTruthy();
      expect(result.graph, `${view} graph`).toBeTruthy();
      expect(result.routing, `${view} routing`).toBeTruthy();
      expect(result.graph!.view?.name).toBe(view);
      expect(result.graph!.intent?.question).toBeTruthy();
      expect(result.graph!.nodes.length).toBeGreaterThan(2);
      expect(result.graph!.edges.length).toBeGreaterThan(0);
    });
  }

  it("context collapses commerce into platform", async () => {
    const result = await renderPipeline(source, { ...renderOptions, view: "context" });
    expect(result.graph!.nodes.map((node) => node.id).sort()).toEqual([
      "customer",
      "email",
      "platform",
      "stripe",
      "warehouse",
    ]);
  });

  it("containers expands commerce boundary without the database", async () => {
    const result = await renderPipeline(source, { ...renderOptions, view: "containers" });
    const ids = result.graph!.nodes.map((node) => node.id).sort();
    expect(ids).toContain("web");
    expect(ids).toContain("api");
    expect(ids).not.toContain("ordersDb");
    expect(ids).not.toContain("platform");
  });
});
