# @kekonic/diagrams-core

Language core for KDiagram: parser, compiler, `GraphModel` types, and source formatting.

## Scope

This package owns the DSL boundary only:

- **parse** — lexer + parser → `KDiagramAst`
- **compile** — AST → `GraphModel` + layout/routing/render hints
- **format** — pretty-print KDiagram source
- **types** — `GraphModel`, geometry helpers (`expandRect`, `manhattan`, `rectsOverlap`), options types

Layout, routing, theme, renderers, and the full pipeline live in sibling packages. Use **`@kekonic/diagrams`** for the integrated browser/CLI API.

## Package map

| Package                        | Responsibility                                                |
| ------------------------------ | ------------------------------------------------------------- |
| `@kekonic/diagrams-core`       | parse, compile, kinds/shapes catalog, types, format           |
| `@kekonic/diagrams-geometry`   | ShapeGeometry library, ports, footprints, node-type bridge    |
| `@kekonic/diagrams-layout`     | measure, ELK layout + orthogonal edges, topology, direction   |
| `@kekonic/diagrams-routing`    | straight/bezier refinement, crossing treatment, endpoint trim |
| `@kekonic/diagrams-theme`      | tokens, styles, CSS                                           |
| `@kekonic/diagrams-render-svg` | SVG renderer                                                  |
| `@kekonic/diagrams`            | pipeline orchestration + `KDiagram` browser API               |
| `@kekonic/diagrams-cli`        | CLI                                                           |

## Quick start

```ts
import { parse, compile, formatSource } from "@kekonic/diagrams-core";

const ast = parse(`diagram "Demo" {
  direction LR
  a: service "A"
  b: service "B"
  a -> b
}`);

const { graph, layoutHints, routingHints, diagnostics } = compile(ast);
```

## Kinds & shapes

```ts
import {
  getKindDefaults,
  isGeometryKind,
  listGeometryKinds,
  BUILTIN_KIND_CATALOG,
} from "@kekonic/diagrams-core";

getKindDefaults("gateway").defaults.shape; // "hexagon"
isGeometryKind("diamond"); // true — bare geometry kind
listGeometryKinds(); // all shape ids usable as kinds
```

Semantic kinds (`service`, `choice`, …) and geometry kinds (`diamond`, `cylinder`, …) share one
catalog. Shape math lives in `@kekonic/diagrams-geometry`.

For end-to-end rendering:

```ts
import { KDiagram } from "@kekonic/diagrams";

const result = await KDiagram.renderToSvg(source);
console.log(result.svg);
```
