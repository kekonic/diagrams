# @kekonic/diagrams-routing

Post-ELK edge finishing for KDiagram: crossing treatment, endpoint trim, and label placement types.

## Scope

- Crossing modes: `none` / `gaps` / `jumps` / `smart`
- Arrowhead / crow's-foot endpoint insets
- Shared `RoutedEdge` / `TreatedEdge` / `EdgeLabelPlacement` types

Orthogonal corridors normally come from ELK (or region-arrange stubs). This package does **not** search routes.

## Install

```bash
pnpm add @kekonic/diagrams-routing
```

Prefer the meta package `@kekonic/diagrams` for the full pipeline.

## Related

- Layout: `@kekonic/diagrams-layout`
- Pipeline boundaries: [`docs/architecture/pipeline.md`](../../docs/architecture/pipeline.md)
