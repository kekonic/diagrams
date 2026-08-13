# `@kekonic/diagrams-remark`

Render fenced `kdiagrams` blocks to static, accessible SVG in Remark and Unified pipelines.

```ts
import remarkKDiagram from "@kekonic/diagrams-remark";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

const html = await unified()
  .use(remarkParse)
  .use(remarkKDiagram)
  .use(remarkRehype)
  .use(rehypeStringify)
  .process(markdown);
```

The plugin converts renderer-generated SVG into HAST and passes it through Unified's standard tree
bridge. It does not emit a raw HTML node or require `rehype-raw`. Diagnostics are attached to the
VFile with their corresponding Markdown positions.
