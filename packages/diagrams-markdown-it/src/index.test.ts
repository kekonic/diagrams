import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vite-plus/test";
import {
  encodeKDiagramFenceSource,
  type KDiagramMarkdownEnvironment,
  kdiagramMarkdownIt,
  isKDiagramFence,
  renderKDiagramMarkdown,
} from "./index.ts";

describe("kdiagram Markdown-it integration", () => {
  it("renders a static accessible SVG and leaves other fences alone", async () => {
    const md = new MarkdownIt();
    kdiagramMarkdownIt(md);
    const html = await renderKDiagramMarkdown(
      md,
      '# System\n\n```kdiagram\ndiagram "Architecture" {\n  api: service "API"\n}\n```\n\n```ts\nconst ok = true\n```',
    );
    expect(html).toContain('<figure class="k-diagram">');
    expect(html).toContain('role="img"');
    expect(html).toContain('data-node-id="api"');
    expect(html).toContain("language-ts");
  });

  it("maps source diagnostics to one-based Markdown lines", async () => {
    const md = new MarkdownIt();
    kdiagramMarkdownIt(md);
    const env: KDiagramMarkdownEnvironment = {};
    await renderKDiagramMarkdown(md, "Before\n\n```kdiagram\ndiagram {\n  ???\n}\n```", env);
    expect(env.kdiagramDiagnostics?.some((item) => item.markdownLine === 5)).toBe(true);
  });

  it("shares safe fence metadata primitives with editor hosts", () => {
    expect(isKDiagramFence("kdiagram title=System")).toBe(true);
    expect(isKDiagramFence("typescript")).toBe(false);
    expect(decodeURIComponent(encodeKDiagramFenceSource('a: service "A"'))).toBe('a: service "A"');
  });
});
