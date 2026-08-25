# @kekonic/diagrams-routing

Post-layout edge finishing for KDiagram: route-style refinement, crossing treatment, endpoint trim, and label placement types.

## Scope

- Route styles: `metro` / `rounded` / `bezier` refine the laid-out corridor into
  organic cubics (port ease + curved avoidance); `orthogonal` keeps sharp corners;
  `straight` shortcuts a clear corridor
- Crossing modes: `none` / `gaps` / `jumps` / `smart`
- Arrowhead / crow's-foot endpoint insets
- Shared `RoutedEdge` / `TreatedEdge` / `EdgeLabelPlacement` types

Orthogonal corridors normally come from ELK (or region-arrange stubs). This package does **not** search a new route grid; it shortens or smooths the corridor it was given.

## Install

```bash
pnpm add @kekonic/diagrams-routing
```

Prefer the meta package `@kekonic/diagrams` for the full pipeline.

## Related

- Layout: `@kekonic/diagrams-layout`
- Pipeline boundaries: [`docs/architecture/pipeline.md`](../../docs/architecture/pipeline.md)
