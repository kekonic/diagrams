# @kekonic/diagrams-render-svg

Static and interactive SVG renderer for KDiagram.

## Scope

- Paint nodes, groups, edges, crossings, and labels from layout + routing results
- CSS-variable theming (live) and optional theme snapshot for export
- Shared shape geometry and measured ELK layout inputs

Does not parse DSL or re-route edges.

## Install

```bash
pnpm add @kekonic/diagrams-render-svg
```

Default path for apps:

```ts
import { KDiagram } from "@kekonic/diagrams";
const { svg } = await KDiagram.renderToSvg(source, { theme: "dark" });
```

Theme stylesheet: `@kekonic/diagrams/theme.css` (or `@kekonic/diagrams-theme/theme.css`).

## Related

- Theme tokens: `@kekonic/diagrams-theme`
- Pipeline boundaries: [`docs/architecture/pipeline.md`](../../docs/architecture/pipeline.md)
