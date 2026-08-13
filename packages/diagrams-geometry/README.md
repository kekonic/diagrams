# @kekonic/diagrams-geometry

Shared shape geometry for KDiagram: paths, safe content regions, ports, perimeter intersection, and layout footprints.

Renderers and layout/routing consume this package so semantic node kinds do not each invent their own shape math. The DSL exposes the same shape ids as first-class kinds (`diamond`, `cylinder`, `cloud`, …).

## ShapeGeometry

```ts
import { resolveShapeGeometry, resolveNodeTypeGeometry } from "@kekonic/diagrams-geometry";

const diamond = resolveShapeGeometry("diamond");
const fromKind = resolveNodeTypeGeometry("gateway"); // → hexagon
```

Each geometry implements path generation, content/visual/footprint bounds, port placement, ray intersection, and hit testing.

Non-rect shapes project side/fan ports onto the silhouette (`projectSidePortOntoOutline`) so ELK `FIXED_POS` pins and `attachPointOnPerimeter` / `snapEdgeEndpointsToGeometry` agree — diamonds, hexes, ellipses, clouds, cylinders, pills, people, etc.

## Related

- Kind catalog: `@kekonic/diagrams-core` (`BUILTIN_KIND_CATALOG`, `listGeometryKinds`)
- Pipeline boundaries: [`docs/architecture/pipeline.md`](../../docs/architecture/pipeline.md)
