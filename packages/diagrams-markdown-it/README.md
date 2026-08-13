# `@kekonic/diagrams-markdown-it`

Render fenced `kdiagrams` blocks to static, accessible SVG in Markdown-it hosts.

```ts
import MarkdownIt from "markdown-it";
import { kdiagramMarkdownIt, renderKDiagramMarkdown } from "@kekonic/diagrams-markdown-it";

const md = new MarkdownIt();
kdiagramMarkdownIt(md);
const html = await renderKDiagramMarkdown(md, markdown);
```

KDiagram layout is asynchronous, so use `renderKDiagramMarkdown()` rather than calling
`md.render()` directly. Static SVG with resolved theme tokens is the default. Diagnostics are
available on `env.kdiagramDiagnostics` with both KDiagram source ranges and one-based Markdown
lines.
