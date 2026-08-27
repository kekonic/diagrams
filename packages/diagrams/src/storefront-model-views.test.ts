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

  for (const view of ["Context", "containers", "components"] as const) {
    it(`renders ${view} without errors`, async () => {
      const result = await renderPipeline(source, { view });

      expect(result.ok, `${view} ok`).toBe(true);
      expect(
        result.diagnostics.filter((d) => d.severity === "error"),
        `${view} errors`,
      ).toHaveLength(0);
      expect(result.layout, `${view} layout`).toBeTruthy();
      expect(result.graph, `${view} graph`).toBeTruthy();
      expect(result.routing, `${view} routing`).toBeTruthy();
      expect(result.graph!.view?.name).toBe(view);
      expect(result.graph!.nodes.length).toBeGreaterThan(2);
      expect(result.graph!.edges.length).toBeGreaterThan(0);
    });
  }

  it("context uses explicit platform summary node", async () => {
    const result = await renderPipeline(source, { view: "Context" });
    expect(result.graph!.nodes.map((node) => node.id).sort()).toEqual([
      "customer",
      "email",
      "platform",
      "stripe",
      "warehouse",
    ]);
    expect(result.graph!.groups.some((group) => group.id === "company")).toBe(true);
    expect(result.graph!.groups.some((group) => group.id === "commerce")).toBe(false);
    expect(result.graph!.nodes.find((node) => node.id === "platform")?.description).toContain(
      "coordinates payment",
    );
  });

  it("containers expands commerce boundary with databases", async () => {
    const result = await renderPipeline(source, { view: "containers" });
    const ids = result.graph!.nodes.map((node) => node.id).sort();
    expect(ids).toContain("web");
    expect(ids).toContain("api");
    expect(ids).toContain("ordersDb");
    expect(ids).toContain("inventoryDb");
    expect(ids).not.toContain("platform");
    expect(result.graph!.groups.some((group) => group.id === "commerce")).toBe(true);
  });

  it("components opens apiComponents and keeps neighbor containers closed", async () => {
    const result = await renderPipeline(source, { view: "components" });
    const ids = result.graph!.nodes.map((node) => node.id).sort();
    expect(ids).toEqual([
      "controller",
      "inventory",
      "notifications",
      "orders",
      "ordersDb",
      "payments",
      "publisher",
      "repo",
      "stripe",
      "web",
    ]);
    expect(ids).not.toContain("api");
    expect(ids).not.toContain("customer");
    expect(result.graph!.groups.some((group) => group.id === "apiComponents")).toBe(true);
    expect(result.graph!.nodes.filter((node) => node.kind === "component")).toHaveLength(5);
  });
});
