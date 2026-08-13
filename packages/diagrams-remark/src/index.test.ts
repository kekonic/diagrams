import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vite-plus/test";
import remarkKDiagram from "./index.ts";

describe("remark KDiagram integration", () => {
  it("emits static accessible SVG without raw HTML processing", async () => {
    const result = await unified()
      .use(remarkParse)
      .use(remarkKDiagram, { renderOptions: { theme: "light" } })
      .use(remarkRehype)
      .use(rehypeStringify)
      .process('# System\n\n```kdiagram\ndiagram "System" { api: service "API" }\n```');

    const html = String(result);
    expect(html).toContain('<figure class="k-diagram">');
    expect(html).toContain('role="img"');
    expect(html).toContain('data-node-id="api"');
    expect(html).not.toContain("```kdiagram");
  });

  it("reports KDiagram diagnostics at Markdown lines", async () => {
    const result = await unified()
      .use(remarkParse)
      .use(remarkKDiagram)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process("Before\n\n```kdiagram\ndiagram {\n  ???\n}\n```");

    expect(
      result.messages.some((message) => message.line === 5 && message.ruleId === "FM006"),
    ).toBe(true);
    expect(String(result)).toContain('class="kdiagram-error"');
  });
});
