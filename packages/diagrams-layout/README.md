# @kekonic/diagrams-layout

Measurement and ELK layered layout for KDiagram diagrams.

## Scope

- Shared `TextMeasurer` (bundled Inter metrics for CLI/browser parity)
- Node/group measurement from `GraphModel`
- ELK layered layout + orthogonal edge paths (`elk-layered-v1` / `elk-orthogonal-v1`)
- Region arrange (`stack` / `row` / `grid`) with obstacle-aware stubs
- Topology helpers and silhouette endpoint snap

## Install

```bash
pnpm add @kekonic/diagrams-layout
```

Most apps should use `@kekonic/diagrams` instead and call `KDiagram.layout` / `renderToSvg`.

## Related

- Routing post-process: `@kekonic/diagrams-routing` (straight/bezier refinement, crossings, trim)
- Geometry / ports: `@kekonic/diagrams-geometry`
- Pipeline boundaries: [`docs/architecture/pipeline.md`](../../docs/architecture/pipeline.md)
