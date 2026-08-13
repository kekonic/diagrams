import { describe, expect, it } from "vite-plus/test";
import { KDiagram, kindHasCapability, compile, parse } from "./index.ts";

describe("Lucide / Iconify icon integration", () => {
  it("parses qualified and bare Lucide icon property values", () => {
    const ast = parse(`diagram {
      n: service "N" { icon: lucide:user }
      m: service "M" { icon: shopping-cart }
      i: icon { icon: "lucide:cloud" }
    }`);
    expect(ast.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const compiled = compile(ast);
    expect(compiled.graph.nodes.find((x) => x.id === "n")?.icon).toBe("lucide:user");
    expect(compiled.graph.nodes.find((x) => x.id === "m")?.icon).toBe("shopping-cart");
    expect(compiled.graph.nodes.find((x) => x.id === "i")?.icon).toBe("lucide:cloud");
    expect(kindHasCapability("icon", "icon-only")).toBe(true);
  });

  it("renders Lucide icons with lazy-loaded collections", async () => {
    const src = `diagram "Icons" {
      direction LR
      ada: user "Ada" { icon: user }
      cart: service "Checkout" { icon: shopping-cart }
      cloud: service "Cloud" { icon: lucide:cloud }
      ada -> cart
      cart -> cloud
    }`;
    const result = await KDiagram.renderToSvg(src, { theme: "light", snapshotTheme: true });
    expect(result.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(result.svg).toContain("flow-node-icon");
    // Lucide icons use nested SVG viewBoxes (typically 0 0 24 24).
    expect(result.svg).toMatch(/viewBox="0 0 24 24"/);
  }, 30_000);
});
