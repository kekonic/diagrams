import { describe, expect, it } from "vite-plus/test";
import { highlightKDiagram } from "./highlight.ts";

describe("highlightKDiagram", () => {
  it("returns dual-theme Shiki HTML for KDiagram source", async () => {
    const html = await highlightKDiagram(`diagram "Hello" {\n  direction LR\n}`);
    expect(html).toContain("shiki");
    expect(html).toContain("--shiki-dark");
    expect(html).toContain("--shiki-light");
    expect(html).toContain("diagram");
  });

  it("highlights untitled diagram blocks", async () => {
    const html = await highlightKDiagram(`diagram {\n  direction LR\n  a: service "A"\n}`);
    expect(html).toContain("diagram");
    expect(html).toContain("direction");
    expect(html).toContain("service");
  });

  it("tokenizes structured column names, types, and flags", async () => {
    const src = `diagram "ERD" {
  orders: table "orders" {
    columns {
      id: uuid PK
      customer_id: uuid FK NN -> customers.id
      status: text NN // pending|paid
    }
  }
}`;
    const html = await highlightKDiagram(src);
    expect(html).toContain("uuid");
    expect(html).toContain("PK");
    expect(html).toContain("FK");
    // Column names / types should not be stuck inside a single string token.
    expect(html).not.toContain('"id: uuid PK"');
  });
});
